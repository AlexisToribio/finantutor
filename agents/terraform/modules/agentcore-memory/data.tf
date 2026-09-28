data "aws_iam_policy_document" "stm_events" {
  statement {
    sid    = "ShortTermMemoryEvents"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:CreateEvent",
      "bedrock-agentcore:GetEvent",
      "bedrock-agentcore:ListEvents",
    ]
    resources = [aws_bedrockagentcore_memory.stm.arn]
  }
}
