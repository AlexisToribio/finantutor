data "aws_region" "current" {
}
data "aws_caller_identity" "current" {
}
resource "aws_dynamodb_table" "app" {
  name         = "${var.prefix}-app"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled = true
  }
}
resource "aws_cognito_user_pool" "students" {
  name                     = "${var.prefix}-students"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
}
resource "aws_cognito_user_pool_client" "spa" {
  name                          = "${var.prefix}-spa"
  user_pool_id                  = aws_cognito_user_pool.students.id
  generate_secret               = false
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  access_token_validity         = 60
  id_token_validity             = 60
  refresh_token_validity        = 7
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
resource "aws_iam_role" "bff" {
  name               = "${var.prefix}-bff"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_cloudwatch_log_group" "bff" {
  name              = "/aws/lambda/${var.prefix}-bff"
  retention_in_days = 14
}
resource "aws_iam_role_policy" "bff" {
  count = var.agent_runtime_arn == null ? 0 : 1
  role  = aws_iam_role.bff.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"], Resource = aws_dynamodb_table.app.arn },
    { Effect = "Allow", Action = ["bedrock-agentcore:InvokeAgentRuntime"], Resource = [var.agent_runtime_arn, "${var.agent_runtime_arn}/*"] },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "arn:aws:s3:::${var.materials_bucket}/incoming/*" },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.bff.arn}:*" }
  ] })
}
resource "aws_lambda_function" "bff" {
  count            = var.agent_runtime_arn == null ? 0 : 1
  function_name    = "${var.prefix}-bff"
  role             = aws_iam_role.bff.arn
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = var.lambda_zip
  source_code_hash = filebase64sha256(var.lambda_zip)
  memory_size      = 512
  timeout          = 120
  environment {
    variables = {
      AUTH_MODE             = "cognito", APP_TABLE = aws_dynamodb_table.app.name, MATERIALS_BUCKET = var.materials_bucket,
      AGENTCORE_RUNTIME_ARN = var.agent_runtime_arn, COGNITO_USER_POOL_ID = aws_cognito_user_pool.students.id,
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.spa.id
    }
  }
  depends_on = [aws_iam_role_policy.bff]
}
resource "aws_lambda_function_url" "bff" {
  count              = var.agent_runtime_arn == null ? 0 : 1
  function_name      = aws_lambda_function.bff[0].function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "RESPONSE_STREAM"
}
