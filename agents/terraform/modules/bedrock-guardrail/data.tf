data "aws_iam_policy_document" "apply_guardrail" {
  statement {
    sid    = "BedrockGuardrail"
    effect = "Allow"
    actions = [
      "bedrock:ApplyGuardrail",
    ]
    resources = [
      aws_bedrock_guardrail.finantutor.guardrail_arn,
    ]
  }
}
