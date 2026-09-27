output "bucket_name" {
  value = module.bucket.bucket_id
}
output "distribution_id" {
  value = module.edge.distribution_id
}
output "domain" {
  value = module.edge.domain_name
}
