terraform {
  backend "s3" {
    bucket = "finantutor-terraform-state-dev"
    key    = "finantutor/dev/frontend.tfstate"
    region = "us-east-1"
  }
}
