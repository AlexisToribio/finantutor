variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "memory_name" {
  description = "AgentCore Memory resource name (STM, no strategies)"
  type        = string
}

variable "event_expiry_duration" {
  description = "Days after which STM raw events expire"
  type        = number
  default     = 30
}

variable "execution_role_name" {
  description = "IAM role that the AgentCore runtime assumes; receives STM event access"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
