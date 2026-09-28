output "execution_role_arn" {
  description = "IAM role ARN for the AgentCore runtime"
  value       = module.agentcore_iam.execution_role_arn
}

output "guardrail_id" {
  description = "Bedrock Guardrail ID"
  value       = module.bedrock_guardrail.guardrail_id
}

output "guardrail_version" {
  description = "Published Bedrock Guardrail version number"
  value       = module.bedrock_guardrail.guardrail_version
}

output "memory_id" {
  description = "AgentCore STM Memory ID"
  value       = module.agentcore_memory.memory_id
}

output "memory_arn" {
  description = "AgentCore STM Memory ARN"
  value       = module.agentcore_memory.memory_arn
}

output "runtime_log_group_name" {
  description = "CloudWatch log group for the AgentCore runtime"
  value       = module.agentcore_iam.runtime_log_group_name
}
