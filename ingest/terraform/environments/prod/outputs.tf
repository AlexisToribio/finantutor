output "ingest_lambda_name" {
  description = "Python ingest Lambda name"
  value       = module.ingest.ingest_lambda_name
}

output "ingest_lambda_arn" {
  description = "Python ingest Lambda ARN"
  value       = module.ingest.ingest_lambda_arn
}

output "books_bucket_name" {
  description = "S3 bucket for teacher book PDFs. Backend BFF BOOKS_BUCKET."
  value       = module.ingest.books_bucket_name
}

output "books_bucket_arn" {
  description = "S3 bucket ARN for teacher book PDFs. Backend BFF IAM incoming/*."
  value       = module.ingest.books_bucket_arn
}

output "books_bucket_id" {
  description = "S3 bucket id for teacher book PDFs"
  value       = module.ingest.books_bucket_id
}

output "vector_bucket_name" {
  description = "S3 Vectors bucket. Set as VECTOR_BUCKET on AgentCore."
  value       = module.ingest.vector_bucket_name
}

output "vector_index_name" {
  description = "S3 Vectors index name. Set as VECTOR_INDEX on AgentCore."
  value       = module.ingest.vector_index_name
}

output "vector_index_arn" {
  description = "S3 Vectors index ARN. AgentCore QueryVectors."
  value       = module.ingest.vector_index_arn
}

output "embedding_model_id" {
  description = "Titan embedding model ID"
  value       = module.ingest.embedding_model_id
}

output "aws_region" {
  description = "AWS region of this stack"
  value       = var.aws_region
}
