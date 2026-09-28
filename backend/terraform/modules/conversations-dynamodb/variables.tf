variable "table_name" {
  description = "DynamoDB table name for conversation bubbles"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
