module "teacher_books_s3" {
  source = "../../modules/teacher-books-s3"

  project_name = var.project_name
  bucket_name  = "${var.project_name}-books-${var.environment}"
  environment  = var.environment
  tags         = var.tags
}

module "teacher_books_s3vectors" {
  source = "../../modules/teacher-books-s3vectors"

  project_name       = var.project_name
  environment        = var.environment
  vector_bucket_name = "${var.project_name}-vectors-${var.environment}"
  tags               = var.tags
}

module "books_ingest_lambda" {
  source = "../../modules/books-ingest-lambda"

  project_name       = var.project_name
  environment        = var.environment
  function_name      = "${var.project_name}-ingest-${var.environment}"
  books_bucket_id    = module.teacher_books_s3.bucket_id
  books_bucket_arn   = module.teacher_books_s3.bucket_arn
  books_bucket_name  = module.teacher_books_s3.bucket_name
  vector_index_arn   = module.teacher_books_s3vectors.index_arn
  vector_bucket_name = module.teacher_books_s3vectors.vector_bucket_name
  vector_index_name  = module.teacher_books_s3vectors.index_name
  embedding_model_id = var.embedding_model_id
  lambda_zip_path    = var.lambda_zip_path
  tags               = var.tags
}
