output "bucket_id" {
  description = "S3 bucket ID for teacher books"
  value       = aws_s3_bucket.books.id
}

output "bucket_arn" {
  description = "S3 bucket ARN for teacher books"
  value       = aws_s3_bucket.books.arn
}

output "bucket_name" {
  description = "S3 bucket name for teacher books"
  value       = aws_s3_bucket.books.bucket
}
