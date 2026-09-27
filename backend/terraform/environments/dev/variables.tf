variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "prefix" {
  type    = string
  default = "finantutor-dev"
}
variable "agent_runtime_arn" {
  type        = string
  description = "Runtime ARN; null creates only the application table and authentication"
  default     = null
}
variable "materials_bucket" {
  type        = string
  description = "Materials bucket; needed when creating the BFF"
  default     = null
}
variable "lambda_zip" {
  type        = string
  description = "Path to packaged BFF code"
  default     = "../../../dist/backend.zip"
}
