variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string
}

variable "spa_bucket_id" {
  description = "SPA S3 bucket id"
  type        = string
}

variable "spa_bucket_arn" {
  description = "SPA S3 bucket ARN"
  type        = string
}

variable "spa_bucket_domain_name" {
  description = "SPA S3 regional domain name"
  type        = string
}

variable "lambda_function_url" {
  description = "Backend Lambda Function URL"
  type        = string
}

variable "lambda_function_name" {
  description = "Backend Lambda function name (for invoke permission)"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
