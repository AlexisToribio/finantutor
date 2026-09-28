variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "books_bucket_id" {
  description = "Teacher books S3 bucket id"
  type        = string
}

variable "books_bucket_arn" {
  description = "Teacher books S3 bucket ARN"
  type        = string
}

variable "vector_index_arn" {
  description = "S3 Vectors index ARN"
  type        = string
}

variable "embedding_model_id" {
  description = "Bedrock embedding model ID (Titan)"
  type        = string
}

variable "books_bucket_name" {
  description = "Teacher books S3 bucket name (Lambda env)"
  type        = string
}

variable "vector_bucket_name" {
  description = "S3 Vectors bucket name"
  type        = string
}

variable "vector_index_name" {
  description = "S3 Vectors index name"
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the built ingest Lambda zip. Placeholder is used if missing."
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
