output "function_name" {
  description = "Lambda function name"
  value       = module.backend.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = module.backend.function_arn
}

output "function_url" {
  description = "Lambda Function URL (IAM). CloudFront is the public origin."
  value       = module.backend.function_url
}

output "conversations_table_name" {
  description = "DynamoDB table for UI conversation bubbles"
  value       = module.backend.conversations_table_name
}

output "aws_region" {
  description = "AWS region of this stack"
  value       = var.aws_region
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID. Set as COGNITO_USER_POOL_ID on the BFF."
  value       = module.backend.cognito_user_pool_id
}

output "cognito_client_id" {
  description = "Cognito SPA client ID. Set as COGNITO_CLIENT_ID / config.json clientId."
  value       = module.backend.cognito_client_id
}

output "cognito_issuer" {
  description = "Cognito JWT issuer"
  value       = module.backend.cognito_issuer
}
