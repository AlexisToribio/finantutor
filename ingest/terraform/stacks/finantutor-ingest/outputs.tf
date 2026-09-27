output "ingest_lambda_name" {
  description = "Python ingest Lambda name"
  value       = module.books_ingest_lambda.function_name
}

output "ingest_lambda_arn" {
  description = "Python ingest Lambda ARN"
  value       = module.books_ingest_lambda.function_arn
}

output "books_bucket_name" {
  description = "S3 bucket name for teacher book PDFs"
  value       = module.teacher_books_s3.bucket_name
}

output "books_bucket_arn" {
  description = "S3 bucket ARN for teacher book PDFs"
  value       = module.teacher_books_s3.bucket_arn
}

output "books_bucket_id" {
  description = "S3 bucket id for teacher book PDFs"
  value       = module.teacher_books_s3.bucket_id
}

output "vector_bucket_name" {
  description = "S3 Vectors bucket name"
  value       = module.teacher_books_s3vectors.vector_bucket_name
}

output "vector_index_name" {
  description = "S3 Vectors index name"
  value       = module.teacher_books_s3vectors.index_name
}

output "vector_index_arn" {
  description = "S3 Vectors index ARN"
  value       = module.teacher_books_s3vectors.index_arn
}

output "embedding_model_id" {
  description = "Titan embedding model ID used by ingest"
  value       = var.embedding_model_id
}
