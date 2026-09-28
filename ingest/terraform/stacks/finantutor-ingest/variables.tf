variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "embedding_model_id" {
  description = "Bedrock embedding model ID (Titan)"
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "lambda_zip_path" {
  description = "Path to the built ingest Lambda zip. Placeholder is used if missing."
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
