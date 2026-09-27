variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "prefix" {
  type    = string
  default = "finantutor-prod"
}
variable "knowledge_base_id" {
  type        = string
  description = "Managed knowledge base ID"
}
variable "knowledge_base_arn" {
  type        = string
  description = "Managed knowledge base ARN"
}
variable "model_id" {
  type        = string
  description = "Bedrock tutor model or inference profile"
  default     = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
}
variable "container_image_uri" {
  type        = string
  description = "ARM64 ECR image URI; null creates prerequisites only"
  default     = null
}
