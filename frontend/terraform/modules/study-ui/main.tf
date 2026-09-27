data "aws_caller_identity" "current" {
}
module "bucket" {
  source      = "../spa-s3"
  bucket_name = "${var.prefix}-spa-${data.aws_caller_identity.current.account_id}"
}
module "edge" {
  source                 = "../spa-cloudfront"
  project_name           = var.prefix
  environment            = "web"
  spa_bucket_id          = module.bucket.bucket_id
  spa_bucket_arn         = module.bucket.bucket_arn
  spa_bucket_domain_name = module.bucket.bucket_regional_domain_name
  lambda_function_url    = var.function_url
  lambda_function_name   = var.function_name
}
