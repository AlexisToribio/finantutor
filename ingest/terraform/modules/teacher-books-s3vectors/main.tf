resource "aws_s3vectors_vector_bucket" "books" {
  vector_bucket_name = var.vector_bucket_name
  force_destroy      = true

  tags = merge(var.tags, {
    Name = var.vector_bucket_name
  })
}

resource "aws_s3vectors_index" "books" {
  index_name         = var.index_name
  vector_bucket_name = aws_s3vectors_vector_bucket.books.vector_bucket_name
  data_type          = "float32"
  dimension          = var.dimension
  distance_metric    = "cosine"

  metadata_configuration {
    non_filterable_metadata_keys = ["source_text"]
  }
}
