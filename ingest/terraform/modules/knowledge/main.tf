data "aws_caller_identity" "current" {
}
data "aws_region" "current" {
}
resource "aws_s3_bucket" "documents" {
  for_each = toset(["materials", "corpus"])
  bucket   = "${var.prefix}-${each.key}-${data.aws_caller_identity.current.account_id}"
}
resource "aws_s3_bucket_public_access_block" "documents" {
  for_each                = aws_s3_bucket.documents
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "documents" {
  for_each = aws_s3_bucket.documents
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  for_each = aws_s3_bucket.documents
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_policy" "tls" {
  for_each = aws_s3_bucket.documents
  bucket   = each.value.id
  policy   = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [each.value.arn, "${each.value.arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } }] })
}
resource "aws_s3_bucket_cors_configuration" "materials" {
  bucket = aws_s3_bucket.documents["materials"].id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 600
  }
}
resource "aws_iam_role" "kb" {
  name               = "${var.prefix}-knowledge"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "bedrock.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }, ArnLike = { "aws:SourceArn" = "arn:aws:bedrock:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:knowledge-base/*" } } }] })
}
resource "aws_iam_role_policy" "kb" {
  role   = aws_iam_role.kb.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.documents["corpus"].arn }, { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.documents["corpus"].arn}/*" }] })
}
resource "aws_bedrockagent_knowledge_base" "course" {
  name     = "${var.prefix}-course"
  role_arn = aws_iam_role.kb.arn
  knowledge_base_configuration {
    type = "MANAGED"
    managed_knowledge_base_configuration {
      embedding_model_type = "MANAGED"
    }
  }
  depends_on = [aws_iam_role_policy.kb]
}
resource "aws_bedrockagent_data_source" "corpus" {
  knowledge_base_id = aws_bedrockagent_knowledge_base.course.id
  name              = "${var.prefix}-corpus"
  data_source_configuration {
    type = "MANAGED_KNOWLEDGE_BASE_CONNECTOR"
    managed_knowledge_base_connector_configuration {
      # Bedrock fills these defaults and returns this canonical key order.
      # The provider models connector_parameters as a JSON string, so preserve
      # that serialization to keep its post-create state consistent.
      connector_parameters = trimspace(<<-JSON
        {"type":"S3","connectionConfiguration":{"bucketName":"${aws_s3_bucket.documents["corpus"].id}","bucketOwnerAccountId":"${data.aws_caller_identity.current.account_id}"},"filterConfiguration":{"maxFileSizeInMegaBytes":"500"},"aclEnabled":false,"version":"1"}
        JSON
      )

      # Preserve Bedrock's managed-connector behavior and plan it explicitly.
      media_extraction_configuration {
        image_extraction_configuration {
          image_extraction_status = "ENABLED"
        }
      }
    }
  }
}
resource "aws_iam_role" "worker" {
  name               = "${var.prefix}-ingest"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${var.prefix}-ingest"
  retention_in_days = 14
}
resource "aws_iam_role_policy" "worker" {
  role = aws_iam_role.worker.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.documents["materials"].arn}/incoming/*" },
    { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${aws_s3_bucket.documents["corpus"].arn}/*" },
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = var.table_arn },
    { Effect = "Allow", Action = ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"], Resource = [aws_bedrockagent_knowledge_base.course.arn, "${aws_bedrockagent_knowledge_base.course.arn}/*"] },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.worker.arn}:*" }
  ] })
}
resource "aws_lambda_function" "worker" {
  function_name    = "${var.prefix}-ingest"
  role             = aws_iam_role.worker.arn
  runtime          = "python3.12"
  handler          = "finantutor_ingest.infrastructure.aws.handler"
  filename         = var.lambda_zip
  source_code_hash = filebase64sha256(var.lambda_zip)
  timeout          = 180
  memory_size      = 1024
  environment {
    variables = { APP_TABLE = var.table_name, MATERIALS_BUCKET = aws_s3_bucket.documents["materials"].id, CORPUS_BUCKET = aws_s3_bucket.documents["corpus"].id, KNOWLEDGE_BASE_ID = aws_bedrockagent_knowledge_base.course.id, DATA_SOURCE_ID = aws_bedrockagent_data_source.corpus.data_source_id }
  }
  depends_on = [aws_iam_role_policy.worker]
}
resource "aws_iam_role" "workflow" {
  name               = "${var.prefix}-ingest-workflow"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "states.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }, ArnLike = { "aws:SourceArn" = "arn:aws:states:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.prefix}-ingest" } } }] })
}
resource "aws_iam_role_policy" "workflow" {
  role   = aws_iam_role.workflow.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.worker.arn }] })
}
resource "aws_sfn_state_machine" "ingest" {
  name       = "${var.prefix}-ingest"
  role_arn   = aws_iam_role.workflow.arn
  type       = "STANDARD"
  definition = templatefile("${path.module}/workflow.json.tftpl", { worker_arn = aws_lambda_function.worker.arn })
  depends_on = [aws_iam_role_policy.workflow]
}
resource "aws_s3_bucket_notification" "incoming" {
  bucket      = aws_s3_bucket.documents["materials"].id
  eventbridge = true
}
resource "aws_cloudwatch_event_rule" "incoming" {
  name          = "${var.prefix}-pdf-arrived"
  event_pattern = jsonencode({ source = ["aws.s3"], "detail-type" = ["Object Created"], detail = { bucket = { name = [aws_s3_bucket.documents["materials"].id] }, object = { key = [{ prefix = "incoming/" }] } } })
}
resource "aws_iam_role" "events" {
  name               = "${var.prefix}-pdf-events"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "events.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }, ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.incoming.arn } } }] })
}
resource "aws_iam_role_policy" "events" {
  role   = aws_iam_role.events.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["states:StartExecution"], Resource = aws_sfn_state_machine.ingest.arn }] })
}
resource "aws_cloudwatch_event_target" "workflow" {
  rule     = aws_cloudwatch_event_rule.incoming.name
  arn      = aws_sfn_state_machine.ingest.arn
  role_arn = aws_iam_role.events.arn
  input_transformer {
    input_paths    = { key = "$.detail.object.key" }
    input_template = "{\"key\":<key>}"
  }
  depends_on = [aws_iam_role_policy.events]
}

resource "aws_iam_role_policy" "failure_tracking" {
  role   = aws_iam_role.worker.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["states:DescribeExecution"], Resource = "arn:aws:states:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:execution:${var.prefix}-ingest:*" }] })
}
resource "aws_cloudwatch_event_rule" "failed_ingest" {
  name          = "${var.prefix}-ingest-failed"
  event_pattern = jsonencode({ source = ["aws.states"], "detail-type" = ["Step Functions Execution Status Change"], detail = { stateMachineArn = [aws_sfn_state_machine.ingest.arn], status = ["FAILED", "TIMED_OUT", "ABORTED"] } })
}
resource "aws_cloudwatch_event_target" "failed_ingest" {
  rule = aws_cloudwatch_event_rule.failed_ingest.name
  arn  = aws_lambda_function.worker.arn
}
resource "aws_lambda_permission" "failure_events" {
  statement_id   = "TrackFailedIngestion"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.worker.function_name
  principal      = "events.amazonaws.com"
  source_arn     = aws_cloudwatch_event_rule.failed_ingest.arn
  source_account = data.aws_caller_identity.current.account_id
}
