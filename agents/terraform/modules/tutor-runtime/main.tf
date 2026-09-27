data "aws_region" "current" {
}
data "aws_caller_identity" "current" {
}
resource "aws_bedrockagentcore_memory" "stm" {
  name                  = replace("${var.prefix}_stm", "-", "_")
  event_expiry_duration = 30
  description           = "Conversation context only; no long-term extraction strategies"
}
resource "aws_iam_role" "runtime" {
  name               = "${var.prefix}-runtime"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "bedrock-agentcore.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }, ArnLike = { "aws:SourceArn" = "arn:aws:bedrock-agentcore:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:runtime/*" } } }] })
}
resource "aws_iam_role_policy" "runtime" {
  role = aws_iam_role.runtime.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"], Resource = ["arn:aws:bedrock:*::foundation-model/${replace(var.model_id, "/^(global|us|eu|apac)\\./", "")}", "arn:aws:bedrock:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.model_id}"] },
    { Effect = "Allow", Action = ["bedrock:Retrieve"], Resource = var.knowledge_base_arn },
    { Effect = "Allow", Action = ["bedrock-agentcore:GetMemory", "bedrock-agentcore:GetEvent", "bedrock-agentcore:CreateEvent", "bedrock-agentcore:ListEvents", "bedrock-agentcore:DeleteEvent"], Resource = aws_bedrockagentcore_memory.stm.arn },
    { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"], Resource = "arn:aws:logs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/bedrock-agentcore/runtimes/${replace(var.prefix, "-", "_")}*" }
  ] })
}
