resource "aws_iam_role" "tutor_execution" {
  name               = "${var.project_name}-execution-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

resource "aws_cloudwatch_log_group" "runtime" {
  name              = var.runtime_log_group_name
  retention_in_days = 7
  tags              = var.tags
}

resource "aws_iam_policy" "runtime" {
  name        = "${var.project_name}-runtime-${var.environment}"
  description = "Bedrock AgentCore runtime permissions (model, logs, tracing)"
  policy      = data.aws_iam_policy_document.runtime.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "runtime" {
  role       = aws_iam_role.tutor_execution.name
  policy_arn = aws_iam_policy.runtime.arn
}
