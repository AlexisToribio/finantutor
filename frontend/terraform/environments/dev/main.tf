module "frontend" {
  source = "../../stacks/finantutor-frontend"

  project_name         = var.project_name
  environment          = var.environment
  lambda_function_url  = data.terraform_remote_state.backend.outputs.function_url
  lambda_function_name = data.terraform_remote_state.backend.outputs.function_name
  tags                 = local.common_tags
}
