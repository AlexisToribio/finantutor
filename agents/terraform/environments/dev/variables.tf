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
  default     = "dev"

  validation {
    condition     = var.environment == "dev"
    error_message = "This stack is only for the dev environment."
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
