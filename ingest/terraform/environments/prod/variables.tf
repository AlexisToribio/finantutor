variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "prefix" {
  type    = string
  default = "finantutor-prod"
}
variable "table_name" {
  type        = string
  description = "Application catalogue table"
}
variable "table_arn" {
  type        = string
  description = "Application catalogue table ARN"
}
variable "allowed_origins" {
  type        = list(string)
  description = "Browser origins permitted for direct uploads and source downloads"
  default     = ["http://127.0.0.1:5173", "http://localhost:5173"]
}
variable "lambda_zip" {
  type        = string
  description = "Packaged ingestion worker"
  default     = "../../../dist/ingest.zip"
}
