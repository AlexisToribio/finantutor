output "vector_bucket_name" {
  description = "S3 Vectors bucket name"
  value       = aws_s3vectors_vector_bucket.books.vector_bucket_name
}

output "vector_bucket_arn" {
  description = "S3 Vectors bucket ARN"
  value       = aws_s3vectors_vector_bucket.books.vector_bucket_arn
}

output "index_name" {
  description = "Vector index name"
  value       = aws_s3vectors_index.books.index_name
}

output "index_arn" {
  description = "Vector index ARN"
  value       = aws_s3vectors_index.books.index_arn
}
