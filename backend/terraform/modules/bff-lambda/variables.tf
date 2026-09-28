variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "agent_runtime_arn" {
  description = "AgentCore Runtime ARN to invoke"
  type        = string
}

variable "agent_runtime_qualifier" {
  description = "AgentCore runtime qualifier (endpoint)"
  type        = string
  default     = "DEFAULT"
}

variable "conversations_table_name" {
  description = "DynamoDB table name for conversation history"
  type        = string
}

variable "conversations_table_arn" {
  description = "DynamoDB table ARN for conversation history"
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the built Lambda zip (index.js). Placeholder is used if missing."
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID used to verify access tokens"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito SPA app client ID"
  type        = string
}

variable "books_bucket_name" {
  description = "Teacher books S3 bucket name for presigned incoming uploads"
  type        = string
}

variable "books_bucket_arn" {
  description = "Teacher books S3 bucket ARN"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
