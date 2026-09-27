resource "aws_cloudwatch_log_group" "ingest" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7
  tags              = var.tags
}

resource "aws_iam_role" "ingest" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
  tags               = var.tags
}

resource "aws_iam_policy" "ingest" {
  name        = "${var.function_name}-policy"
  description = "Index Finantutor course PDFs from S3 into S3 Vectors with Titan embeddings"
  policy      = data.aws_iam_policy_document.ingest.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "ingest" {
  role       = aws_iam_role.ingest.name
  policy_arn = aws_iam_policy.ingest.arn
}

resource "aws_lambda_function" "ingest" {
  function_name    = var.function_name
  role             = aws_iam_role.ingest.arn
  runtime          = "python3.12"
  handler          = "finantutor_ingest.infrastructure.aws.handler"
  filename         = local.lambda_zip
  source_code_hash = local.lambda_hash
  timeout          = 900
  memory_size      = 2048

  environment {
    variables = {
      MATERIALS_BUCKET   = var.books_bucket_name
      VECTOR_BUCKET      = var.vector_bucket_name
      VECTOR_INDEX       = var.vector_index_name
      EMBEDDING_MODEL_ID = var.embedding_model_id
      APP_TABLE          = var.table_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.ingest]
  tags       = var.tags
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowBooksBucketInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.books_bucket_arn
}

resource "aws_s3_bucket_notification" "incoming" {
  bucket = var.books_bucket_id

  lambda_function {
    lambda_function_arn = aws_lambda_function.ingest.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "incoming/"
    filter_suffix       = ".pdf"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}
