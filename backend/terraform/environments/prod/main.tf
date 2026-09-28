module "backend" {
  source = "../../stacks/finantutor-backend"

  project_name            = var.project_name
  environment             = var.environment
  agent_runtime_arn       = var.agent_runtime_arn
  agent_runtime_qualifier = var.agent_runtime_qualifier
  books_bucket_name       = data.terraform_remote_state.ingest.outputs.books_bucket_name
  books_bucket_arn        = data.terraform_remote_state.ingest.outputs.books_bucket_arn
  lambda_zip_path         = "${path.module}/../../../dist/lambda.zip"
  tags                    = local.common_tags
}
