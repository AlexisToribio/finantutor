provider "aws" {
  region = var.aws_region
  default_tags { tags = { Project = "finantutor", Environment = "prod", ManagedBy = "terraform" } }
}
