module "ingest" {
  source = "../../stacks/finantutor-ingest"

  project_name       = var.project_name
  environment        = var.environment
  embedding_model_id = var.embedding_model_id
  lambda_zip_path    = "${path.module}/../../../dist/ingest.zip"
  table_name         = var.table_name
  table_arn           = var.table_arn
  tags               = local.common_tags
}
