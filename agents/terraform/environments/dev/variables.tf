variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "prefix" {
  type    = string
  default = "finantutor-dev"
}

variable "vector_bucket_name" {
  type        = string
  description = "S3 Vectors bucket name from the ingest stack"
}

variable "vector_index_name" {
  type        = string
  description = "S3 Vectors index name from the ingest stack"
}

variable "vector_index_arn" {
  type        = string
  description = "S3 Vectors index ARN from the ingest stack"
}

variable "embedding_model_id" {
  type        = string
  description = "Titan Text Embeddings model ID"
  default     = "amazon.titan-embed-text-v2:0"
}

variable "model_id" {
  type        = string
  description = "Bedrock tutor model or inference profile"
  default     = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
}
