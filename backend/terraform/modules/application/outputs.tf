output "table_name" {
  value = aws_dynamodb_table.app.name
}
output "table_arn" {
  value = aws_dynamodb_table.app.arn
}
output "cognito_pool_id" {
  value = aws_cognito_user_pool.students.id
}
output "cognito_client_id" {
  value = aws_cognito_user_pool_client.spa.id
}
output "function_url" {
  value = try(aws_lambda_function_url.bff[0].function_url, null)
}
output "function_name" {
  value = try(aws_lambda_function.bff[0].function_name, null)
}
