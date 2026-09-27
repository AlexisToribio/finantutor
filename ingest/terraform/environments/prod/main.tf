module "stack" {
  source          = "../../modules/knowledge"
  prefix          = var.prefix
  table_name      = var.table_name
  table_arn       = var.table_arn
  allowed_origins = var.allowed_origins
  lambda_zip      = var.lambda_zip
}
