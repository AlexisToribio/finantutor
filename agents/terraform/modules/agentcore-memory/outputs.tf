output "memory_id" {
  description = "AgentCore Memory ID. Set as AGENTCORE_MEMORY_ID on the runtime."
  value       = aws_bedrockagentcore_memory.stm.id
}

output "memory_arn" {
  description = "AgentCore Memory ARN used in the STM IAM policy"
  value       = aws_bedrockagentcore_memory.stm.arn
}
