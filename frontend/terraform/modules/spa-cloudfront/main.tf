resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.project_name}-spa-s3-${var.environment}"
  description                       = "OAC for SPA bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "lambda" {
  name                              = "${var.project_name}-bff-lambda-${var.environment}"
  description                       = "OAC for Lambda Function URL"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "spa" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} ${var.environment} SPA"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = var.spa_bucket_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    domain_name              = local.lambda_domain
    origin_id                = local.lambda_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda.id

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }
  }

  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routes.arn
    }
  }

  # CloudFront OAC signs the Function URL with Authorization (SigV4) and drops the
  # viewer's Bearer token. The SPA sends the JWT again as X-Authorization.
  ordered_cache_behavior {
    path_pattern             = "/api*"
    target_origin_id         = local.lambda_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = false
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.api_content_type.arn
    }
  }

  # SPA routes (/login, /libros) are rewritten by CloudFront Function, not by
  # custom error pages. Mapping 403/404 to index.html hid Lambda POST failures.

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.tags
}

resource "aws_cloudfront_function" "api_content_type" {
  name    = "${var.project_name}-api-content-type-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Force JSON or SSE on /api*; Lambda streaming sometimes leaves octet-stream"
  publish = true
  code    = file("${path.module}/api-content-type.js")
}

resource "aws_cloudfront_function" "spa_routes" {
  name    = "${var.project_name}-spa-routes-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite SPA paths to /index.html; leave /assets and files with an extension"
  publish = true
  code    = file("${path.module}/spa-routes.js")
}

resource "aws_s3_bucket_policy" "spa" {
  bucket = var.spa_bucket_id
  policy = data.aws_iam_policy_document.spa_bucket.json
}

resource "aws_lambda_permission" "function_url" {
  statement_id           = "AllowCloudFrontInvokeUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = var.lambda_function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.spa.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "function" {
  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.spa.arn
}
