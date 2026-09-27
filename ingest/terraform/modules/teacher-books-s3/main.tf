resource "aws_s3_bucket" "books" {
  bucket = var.bucket_name

  tags = merge(var.tags, {
    Name = var.bucket_name
  })
}

resource "aws_s3_bucket_versioning" "books" {
  bucket = aws_s3_bucket.books.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "books" {
  bucket = aws_s3_bucket.books.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "books" {
  bucket = aws_s3_bucket.books.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "books" {
  bucket = aws_s3_bucket.books.id

  cors_rule {
    allowed_headers = local.cors_allowed_headers
    allowed_methods = local.cors_allowed_methods
    allowed_origins = local.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
