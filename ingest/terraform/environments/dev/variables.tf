variable "aws_region" {
  description = "AWS region for the ingestion resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "finantutor"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "embedding_model_id" {
  description = "Bedrock Titan embedding model ID"
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "table_name" {
  description = "Finantutor application table"
  type        = string
}

variable "table_arn" {
  description = "Finantutor application table ARN"
  type        = string
}
