output "bucket_id" {
  description = "SPA S3 bucket id"
  value       = module.spa_s3.bucket_id
}

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.spa_cloudfront.distribution_id
}

output "domain_name" {
  description = "CloudFront domain name"
  value       = module.spa_cloudfront.domain_name
}
