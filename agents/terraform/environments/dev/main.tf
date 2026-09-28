module "finantutor" {
  source = "../../stacks/finantutor"

  project_name     = var.project_name
  environment      = var.environment
  agent_name       = var.agent_name
  model_id         = var.model_id
  vector_index_arn = data.terraform_remote_state.ingest.outputs.vector_index_arn
  tags             = local.common_tags
}
