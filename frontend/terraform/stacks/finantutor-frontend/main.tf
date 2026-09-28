module "spa_s3" {
  source = "../../modules/spa-s3"

  bucket_name = "${var.project_name}-spa-${var.environment}"
  tags        = var.tags
}

module "spa_cloudfront" {
  source = "../../modules/spa-cloudfront"

  project_name           = var.project_name
  environment            = var.environment
  spa_bucket_id          = module.spa_s3.bucket_id
  spa_bucket_arn         = module.spa_s3.bucket_arn
  spa_bucket_domain_name = module.spa_s3.bucket_regional_domain_name
  lambda_function_url    = var.lambda_function_url
  lambda_function_name   = var.lambda_function_name
  tags                   = var.tags
}
