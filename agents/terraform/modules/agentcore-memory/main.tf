resource "aws_bedrockagentcore_memory" "stm" {
  name                  = var.memory_name
  description           = "Short-term conversation events only (no LTM strategies)"
  event_expiry_duration = var.event_expiry_duration
  tags                  = var.tags
}

resource "aws_iam_policy" "stm_events" {
  name        = "${var.project_name}-stm-${var.environment}"
  description = "AgentCore STM events on this memory only (no LTM retrieve)"
  policy      = data.aws_iam_policy_document.stm_events.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "stm_events" {
  role       = var.execution_role_name
  policy_arn = aws_iam_policy.stm_events.arn
}
