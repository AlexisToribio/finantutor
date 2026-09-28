output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.teachers.id
}

output "client_id" {
  description = "Public SPA app client ID"
  value       = aws_cognito_user_pool_client.spa.id
}

output "region" {
  description = "AWS region of the User Pool"
  value       = data.aws_region.current.region
}

output "issuer" {
  description = "JWT issuer URL for aws-jwt-verify"
  value       = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.teachers.id}"
}
