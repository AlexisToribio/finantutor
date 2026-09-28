output "bucket_id" {
  description = "SPA S3 bucket. Sync the Vite build here."
  value       = module.frontend.bucket_id
}

output "distribution_id" {
  description = "CloudFront distribution ID for invalidation"
  value       = module.frontend.distribution_id
}

output "domain_name" {
  description = "CloudFront domain (https://{domain_name})"
  value       = module.frontend.domain_name
}

output "aws_region" {
  description = "AWS region of this stack"
  value       = var.aws_region
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID for SPA config.json"
  value       = data.terraform_remote_state.backend.outputs.cognito_user_pool_id
}

output "cognito_client_id" {
  description = "Cognito SPA client ID for config.json"
  value       = data.terraform_remote_state.backend.outputs.cognito_client_id
}
