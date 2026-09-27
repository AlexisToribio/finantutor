module "stack" {
  source             = "../../modules/tutor-runtime"
  prefix             = var.prefix
  vector_bucket_name = var.vector_bucket_name
  vector_index_name  = var.vector_index_name
  vector_index_arn   = var.vector_index_arn
  embedding_model_id = var.embedding_model_id
  model_id           = var.model_id
}
