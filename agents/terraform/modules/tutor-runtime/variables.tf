variable "prefix" {
  type        = string
  description = "Resource naming prefix"
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
