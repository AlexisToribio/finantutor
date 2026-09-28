module "conversations" {
  source = "../../modules/conversations-dynamodb"

  table_name = "${var.project_name}-conversations-${var.environment}"
  tags       = var.tags
}

module "cognito" {
  source = "../../modules/cognito-user-pool"

  project_name = var.project_name
  environment  = var.environment
  tags         = var.tags
}

module "bff_lambda" {
  source = "../../modules/bff-lambda"

  function_name            = "${var.project_name}-bff-${var.environment}"
  agent_runtime_arn        = var.agent_runtime_arn
  agent_runtime_qualifier  = var.agent_runtime_qualifier
  conversations_table_name = module.conversations.table_name
  conversations_table_arn  = module.conversations.table_arn
  cognito_user_pool_id     = module.cognito.user_pool_id
  cognito_client_id        = module.cognito.client_id
  books_bucket_name        = var.books_bucket_name
  books_bucket_arn         = var.books_bucket_arn
  lambda_zip_path          = var.lambda_zip_path
  tags                     = var.tags
}
