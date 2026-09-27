output "execution_role_arn" {
  value = aws_iam_role.runtime.arn
}
output "memory_id" {
  value = aws_bedrockagentcore_memory.stm.id
}
output "model_id" {
  value = var.model_id
}
