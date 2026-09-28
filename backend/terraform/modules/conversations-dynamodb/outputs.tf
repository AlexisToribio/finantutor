output "table_name" {
  description = "Conversations table name"
  value       = aws_dynamodb_table.conversations.name
}

output "table_arn" {
  description = "Conversations table ARN"
  value       = aws_dynamodb_table.conversations.arn
}
