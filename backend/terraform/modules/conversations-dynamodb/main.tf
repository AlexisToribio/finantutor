resource "aws_dynamodb_table" "conversations" {
  name         = var.table_name
  billing_mode = "PROVISIONED"
  hash_key     = "source"
  range_key    = "id"

  read_capacity  = 1
  write_capacity = 1

  attribute {
    name = "source"
    type = "S"
  }

  attribute {
    name = "id"
    type = "N"
  }

  tags = merge(var.tags, {
    Name = var.table_name
  })
}
