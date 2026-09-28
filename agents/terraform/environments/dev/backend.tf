terraform {
  backend "s3" {
    bucket = "finantutor-terraform-state-dev"
    key    = "finantutor/dev/agents.tfstate"
    region = "us-east-1"
  }
}
