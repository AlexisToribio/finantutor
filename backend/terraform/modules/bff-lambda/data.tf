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
    content  = file("${path.module}/placeholder/index.js")
    filename = "index.js"
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

data "aws_iam_policy_document" "api" {
  statement {
    sid       = "InvokeAgentRuntime"
    effect    = "Allow"
    actions   = ["bedrock-agentcore:InvokeAgentRuntime"]
    resources = [
      var.agent_runtime_arn,
      "${var.agent_runtime_arn}/*",
    ]
  }

  statement {
    sid    = "ConversationsTable"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem",
    ]
    resources = [var.conversations_table_arn]
  }

  statement {
    sid    = "IncomingPresign"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:AbortMultipartUpload",
    ]
    resources = ["${var.books_bucket_arn}/incoming/*"]
  }

  statement {
    sid    = "LambdaLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.api.arn,
      "${aws_cloudwatch_log_group.api.arn}:log-stream:*",
    ]
  }
}
