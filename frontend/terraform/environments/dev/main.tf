module "stack" {
  source        = "../../modules/study-ui"
  prefix        = var.prefix
  function_url  = var.function_url
  function_name = var.function_name
}
