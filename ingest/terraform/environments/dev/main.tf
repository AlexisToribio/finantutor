module "ingest" {
  source = "../../stacks/finantutor-ingest"

  project_name    = var.project_name
  environment     = var.environment
  lambda_zip_path = "${path.module}/../../../dist/ingest.zip"
  tags            = local.common_tags
}
