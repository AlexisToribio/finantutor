output "materials_bucket" {
  value = aws_s3_bucket.documents["materials"].id
}
output "corpus_bucket" {
  value = aws_s3_bucket.documents["corpus"].id
}
output "knowledge_base_id" {
  value = aws_bedrockagent_knowledge_base.course.id
}
output "knowledge_base_arn" {
  value = aws_bedrockagent_knowledge_base.course.arn
}
output "data_source_id" {
  value = aws_bedrockagent_data_source.corpus.data_source_id
}
output "workflow_arn" {
  value = aws_sfn_state_machine.ingest.arn
}
