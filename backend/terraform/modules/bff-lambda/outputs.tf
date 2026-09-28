output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.api.arn
}

output "function_url" {
  description = "Lambda Function URL (IAM auth; call only via CloudFront OAC)"
  value       = aws_lambda_function_url.api.function_url
}

output "function_url_id" {
  description = "Lambda Function URL ID"
  value       = aws_lambda_function_url.api.id
}
