output "execution_role_arn" {
  description = "ARN of the Finantutor AgentCore execution role"
  value       = aws_iam_role.tutor_execution.arn
}

output "execution_role_name" {
  description = "Name of the Finantutor AgentCore execution role"
  value       = aws_iam_role.tutor_execution.name
}

output "runtime_log_group_name" {
  description = "CloudWatch log group for the AgentCore runtime (7-day retention)"
  value       = aws_cloudwatch_log_group.runtime.name
}
