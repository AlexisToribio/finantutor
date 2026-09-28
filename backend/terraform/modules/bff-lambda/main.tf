resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7
  tags              = var.tags
}

resource "aws_lambda_function" "api" {
  function_name    = var.function_name
  role             = aws_iam_role.api.arn
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = local.lambda_zip
  source_code_hash = local.lambda_hash
  timeout          = 120
  memory_size      = 256

  environment {
    variables = {
      AGENTCORE_RUNTIME_ARN = var.agent_runtime_arn
      AGENTCORE_QUALIFIER   = var.agent_runtime_qualifier
      CONVERSATIONS_TABLE   = var.conversations_table_name
      COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
      COGNITO_CLIENT_ID     = var.cognito_client_id
      BOOKS_BUCKET          = var.books_bucket_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]
  tags       = var.tags
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "RESPONSE_STREAM"
}

resource "aws_iam_role" "api" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
  tags               = var.tags
}

resource "aws_iam_policy" "api" {
  name        = "${var.function_name}-policy"
  description = "Invoke the course tutor, store conversation history and presign material uploads"
  policy      = data.aws_iam_policy_document.api.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "api" {
  role       = aws_iam_role.api.name
  policy_arn = aws_iam_policy.api.arn
}
