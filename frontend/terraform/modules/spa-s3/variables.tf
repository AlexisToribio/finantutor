variable "bucket_name" {
  description = "S3 bucket name for the SPA"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
