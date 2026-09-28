output "execution_role_arn" {
  description = "IAM role ARN for AgentCore Runtime. Pass to agentcore configure --execution-role."
  value       = module.finantutor.execution_role_arn
}

output "guardrail_id" {
  description = "Bedrock Guardrail ID. Set as GUARDRAIL_ID on the AgentCore runtime."
  value       = module.finantutor.guardrail_id
}

output "guardrail_version" {
  description = "Published Guardrail version. Set as GUARDRAIL_VERSION on the AgentCore runtime."
  value       = module.finantutor.guardrail_version
}

output "aws_region" {
  description = "AWS region of this stack"
  value       = var.aws_region
}

output "model_id" {
  description = "Bedrock model configured for the Finantutor tutor"
  value       = var.model_id
}

output "memory_id" {
  description = "AgentCore STM Memory ID. Set as AGENTCORE_MEMORY_ID on the runtime."
  value       = module.finantutor.memory_id
}

output "runtime_log_group_name" {
  description = "CloudWatch log group for the AgentCore runtime (retention 7 days)."
  value       = module.finantutor.runtime_log_group_name
}
