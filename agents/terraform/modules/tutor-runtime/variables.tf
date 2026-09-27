variable "prefix" {
  type        = string
  description = "Resource naming prefix"
}
variable "vector_bucket_name" {
  type        = string
  description = "S3 Vectors bucket used by the course tutor"
}

variable "vector_index_name" {
  type        = string
  description = "S3 Vectors index used by the course tutor"
}

variable "vector_index_arn" {
  type        = string
  description = "S3 Vectors index ARN used for scoped retrieval permissions"
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
