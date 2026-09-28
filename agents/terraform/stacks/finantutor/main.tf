module "agentcore_iam" {
  source = "../../modules/agentcore-iam"

  project_name           = var.project_name
  environment            = var.environment
  agent_name             = var.agent_name
  runtime_log_group_name = "/aws/bedrock-agentcore/runtimes/${var.agent_name}-DEFAULT"
  model_id               = var.model_id
  embedding_model_id     = var.embedding_model_id
  vector_index_arn       = var.vector_index_arn
  tags                   = var.tags
}

module "bedrock_guardrail" {
  source = "../../modules/bedrock-guardrail"

  project_name        = var.project_name
  environment         = var.environment
  execution_role_name = module.agentcore_iam.execution_role_name
  tags                = var.tags
}

module "agentcore_memory" {
  source = "../../modules/agentcore-memory"

  project_name        = var.project_name
  environment         = var.environment
  memory_name         = "${var.project_name}_stm_${var.environment}"
  execution_role_name = module.agentcore_iam.execution_role_name
  tags                = var.tags
}
