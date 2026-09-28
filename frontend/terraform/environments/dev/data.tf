locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "terraform_remote_state" "backend" {
  backend = "s3"
  config = {
    bucket = "finantutor-terraform-state-dev"
    key    = "finantutor/dev/backend.tfstate"
    region = "us-east-1"
  }
}
