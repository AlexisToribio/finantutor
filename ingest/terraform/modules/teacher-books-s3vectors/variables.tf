variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "vector_bucket_name" {
  description = "Name of the S3 Vectors bucket"
  type        = string
}

variable "index_name" {
  description = "Name of the vector index for book chunks"
  type        = string
  default     = "books"
}

variable "dimension" {
  description = "Embedding dimension (Titan Text Embeddings V2 default is 1024)"
  type        = number
  default     = 1024
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
