module "stack" {
  source            = "../../modules/application"
  prefix            = var.prefix
  agent_runtime_arn = var.agent_runtime_arn
  materials_bucket  = var.materials_bucket
  lambda_zip        = var.lambda_zip
}
