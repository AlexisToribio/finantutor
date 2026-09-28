output "function_name" {
  description = "Lambda function name"
  value       = module.bff_lambda.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = module.bff_lambda.function_arn
}

output "function_url" {
  description = "Lambda Function URL"
  value       = module.bff_lambda.function_url
}

output "conversations_table_name" {
  description = "DynamoDB conversations table name"
  value       = module.conversations.table_name
}

output "conversations_table_arn" {
  description = "DynamoDB conversations table ARN"
  value       = module.conversations.table_arn
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito SPA app client ID"
  value       = module.cognito.client_id
}

output "cognito_issuer" {
  description = "Cognito JWT issuer"
  value       = module.cognito.issuer
}
