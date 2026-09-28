variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "agent_runtime_arn" {
  description = "AgentCore Runtime ARN created by agentcore deploy"
  type        = string

  validation {
    condition     = startswith(var.agent_runtime_arn, "arn:aws:bedrock-agentcore:")
    error_message = "Set agent_runtime_arn to the AgentCore Runtime ARN after agentcore deploy."
  }
}

variable "agent_runtime_qualifier" {
  description = "AgentCore runtime qualifier (endpoint)"
  type        = string
  default     = "DEFAULT"
}

variable "books_bucket_name" {
  description = "Teacher books S3 bucket name from the ingest stack"
  type        = string
}

variable "books_bucket_arn" {
  description = "Teacher books S3 bucket ARN from the ingest stack"
  type        = string
}

variable "lambda_zip_path" {
  description = "Absolute or environment-relative path to dist/lambda.zip"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
