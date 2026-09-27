data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.region
  zip_exists  = fileexists(var.lambda_zip_path)
  lambda_zip  = local.zip_exists ? var.lambda_zip_path : data.archive_file.placeholder[0].output_path
  lambda_hash = local.zip_exists ? filebase64sha256(var.lambda_zip_path) : data.archive_file.placeholder[0].output_base64sha256
}

data "archive_file" "placeholder" {
  count       = local.zip_exists ? 0 : 1
  type        = "zip"
  output_path = "${path.module}/.placeholder.zip"
  source {
    content  = file("${path.module}/placeholder/ingest.py")
    filename = "ingest.py"
  }
}

data "aws_iam_policy_document" "assume_lambda" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ingest" {
  statement {
    sid    = "IncomingRead"
    effect = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${var.books_bucket_arn}/incoming/*"]
  }

  statement {
    sid    = "S3VectorsUpsert"
    effect = "Allow"
    actions = [
      "s3vectors:PutVectors",
    ]
    resources = [var.vector_index_arn]
  }

  statement {
    sid       = "MaterialStatus"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [var.table_arn]
  }

  statement {
    sid       = "TitanEmbed"
    effect    = "Allow"
    actions   = ["bedrock:InvokeModel"]
    resources = ["arn:aws:bedrock:${local.region}::foundation-model/${var.embedding_model_id}"]
  }

  statement {
    sid    = "LambdaLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.ingest.arn,
      "${aws_cloudwatch_log_group.ingest.arn}:log-stream:*",
    ]
  }
}
