variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket for teacher textbook PDFs used as RAG source"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
