module "stack" {
  source              = "../../modules/tutor-runtime"
  prefix              = var.prefix
  knowledge_base_id   = var.knowledge_base_id
  knowledge_base_arn  = var.knowledge_base_arn
  model_id            = var.model_id
  container_image_uri = var.container_image_uri
}
