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

variable "runtime_log_group_name" {
  description = "CloudWatch log group used by this AgentCore runtime"
  type        = string
}

variable "model_id" {
  description = "Bedrock model ID used by the course tutor"
  type        = string
}

variable "embedding_model_id" {
  description = "Bedrock embedding model ID (Titan)"
  type        = string
}

variable "vector_index_arn" {
  description = "S3 Vectors index ARN from the ingest stack (QueryVectors)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
