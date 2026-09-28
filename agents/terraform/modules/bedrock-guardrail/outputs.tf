output "guardrail_id" {
  description = "Bedrock Guardrail ID"
  value       = aws_bedrock_guardrail.finantutor.guardrail_id
}

output "guardrail_arn" {
  description = "Bedrock Guardrail ARN"
  value       = aws_bedrock_guardrail.finantutor.guardrail_arn
}

output "guardrail_version" {
  description = "Published Bedrock Guardrail version number"
  value       = aws_bedrock_guardrail_version.finantutor.version
}
