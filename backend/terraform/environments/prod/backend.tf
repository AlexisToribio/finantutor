terraform {
  backend "s3" {
    bucket = "finantutor-terraform-state-prod"
    key    = "finantutor/prod/backend.tfstate"
    region = "us-east-1"
  }
}
