terraform {
  backend "s3" {
    bucket = "finantutor-terraform-state-prod"
    key    = "finantutor/prod/frontend.tfstate"
    region = "us-east-1"
  }
}
