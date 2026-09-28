variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "agent_name" {
  description = "AgentCore runtime / agent name used in workload-identity ARNs"
  type        = string
  default     = "finantutor"
}

variable "model_id" {
  description = "Bedrock model ID used by the course tutor"
  type        = string
  default     = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
}

variable "embedding_model_id" {
  description = "Bedrock embedding model ID (Titan)"
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "vector_index_arn" {
  description = "S3 Vectors index ARN from the ingest stack"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
