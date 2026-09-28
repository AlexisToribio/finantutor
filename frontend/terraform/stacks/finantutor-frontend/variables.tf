variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "lambda_function_url" {
  description = "Backend Lambda Function URL from the backend stack"
  type        = string
}

variable "lambda_function_name" {
  description = "Backend Lambda function name from the backend stack"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
