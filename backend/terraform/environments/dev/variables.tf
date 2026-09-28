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

variable "agent_runtime_arn" {
  description = "AgentCore Runtime ARN from agentcore deploy"
  type        = string
}

variable "agent_runtime_qualifier" {
  description = "AgentCore runtime qualifier (endpoint)"
  type        = string
  default     = "DEFAULT"
}
