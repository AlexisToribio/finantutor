data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id          = data.aws_caller_identity.current.account_id
  region              = data.aws_region.current.region
  foundation_model_id = replace(var.model_id, "global.", "")
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    sid     = "AssumeRolePolicy"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["bedrock-agentcore.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:bedrock-agentcore:${local.region}:${local.account_id}:*"]
    }
  }
}

data "aws_iam_policy_document" "runtime" {
  statement {
    sid    = "BedrockModelInvocation"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = distinct(concat(
      [
        "arn:aws:bedrock:${local.region}:${local.account_id}:inference-profile/${var.model_id}",
        "arn:aws:bedrock:*::foundation-model/${local.foundation_model_id}",
        "arn:aws:bedrock:${local.region}::foundation-model/${var.embedding_model_id}",
      ],
    ))
  }

  # First invoke of Anthropic (Marketplace) auto-subscribes. Without this, ConverseStream
  # returns AccessDeniedException on ViewSubscriptions/Subscribe.
  statement {
    sid    = "MarketplaceModelAccess"
    effect = "Allow"
    actions = [
      "aws-marketplace:ViewSubscriptions",
      "aws-marketplace:Subscribe",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "CloudWatchLogGroups"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:DescribeLogStreams",
    ]
    resources = [
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/bedrock-agentcore/runtimes/*",
    ]
  }

  statement {
    sid       = "CloudWatchDescribeLogGroups"
    effect    = "Allow"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["arn:aws:logs:${local.region}:${local.account_id}:log-group:*"]
  }

  statement {
    sid    = "CloudWatchLogDeliveryPolicy"
    effect = "Allow"
    actions = [
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "CloudWatchLogStreams"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*",
    ]
  }

  # X-Ray PutTraceSegments / GetSampling* do not accept resource ARNs.
  statement {
    sid    = "XRayTracing"
    effect = "Allow"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "CloudWatchMetrics"
    effect    = "Allow"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["bedrock-agentcore"]
    }
  }

  statement {
    sid    = "GetAgentAccessToken"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:GetWorkloadAccessToken",
      "bedrock-agentcore:GetWorkloadAccessTokenForJWT",
      "bedrock-agentcore:GetWorkloadAccessTokenForUserId",
    ]
    resources = [
      "arn:aws:bedrock-agentcore:${local.region}:${local.account_id}:workload-identity-directory/default",
      "arn:aws:bedrock-agentcore:${local.region}:${local.account_id}:workload-identity-directory/default/workload-identity/${var.agent_name}-*",
    ]
  }

  statement {
    sid    = "S3VectorsQuery"
    effect = "Allow"
    actions = [
      "s3vectors:QueryVectors",
      "s3vectors:GetVectors",
    ]
    resources = [var.vector_index_arn]
  }
}
