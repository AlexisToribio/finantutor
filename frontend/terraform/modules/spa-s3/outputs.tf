output "bucket_id" {
  description = "SPA bucket id"
  value       = aws_s3_bucket.spa.id
}

output "bucket_arn" {
  description = "SPA bucket ARN"
  value       = aws_s3_bucket.spa.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name for CloudFront S3 origin"
  value       = aws_s3_bucket.spa.bucket_regional_domain_name
}
