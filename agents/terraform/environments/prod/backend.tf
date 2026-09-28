terraform {
  backend "s3" {
    bucket = "finantutor-terraform-state-prod"
    key    = "finantutor/prod/agents.tfstate"
    region = "us-east-1"
  }
}
