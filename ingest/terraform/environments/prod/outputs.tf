output "ingest_lambda_name" {
  value = module.ingest.ingest_lambda_name
}

output "materials_bucket" {
  value = module.ingest.books_bucket_name
}

output "materials_bucket_arn" {
  value = module.ingest.books_bucket_arn
}

output "vector_bucket_name" {
  value = module.ingest.vector_bucket_name
}

output "vector_index_name" {
  value = module.ingest.vector_index_name
}

output "vector_index_arn" {
  value = module.ingest.vector_index_arn
}

output "embedding_model_id" {
  value = module.ingest.embedding_model_id
}
