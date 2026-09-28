variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "finantutor"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"

  validation {
    condition     = var.environment == "prod"
    error_message = "This stack is only for the prod environment."
  }
}

variable "agent_name" {
  description = "Bedrock AgentCore agent name"
  type        = string
  default     = "finantutor"
}

variable "model_id" {
  description = "Bedrock model used by the course tutor"
  type        = string
  default     = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
}
