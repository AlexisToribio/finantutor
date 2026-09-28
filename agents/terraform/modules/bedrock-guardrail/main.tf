resource "aws_bedrock_guardrail" "finantutor" {
  name                      = "${var.project_name}-guardrail-${var.environment}"
  blocked_input_messaging   = "La consulta no cumple las reglas de uso del tutor."
  blocked_outputs_messaging = "El contenido generado fue bloqueado por contener material inapropiado."
  description               = "Guardrail para el tutor universitario de finanzas"

  content_policy_config {
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "HATE"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "INSULTS"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "SEXUAL"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "VIOLENCE"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "MISCONDUCT"
    }
    filters_config {
      input_strength  = "MEDIUM"
      output_strength = "NONE"
      type            = "PROMPT_ATTACK"
    }
  }

  topic_policy_config {
    topics_config {
      name       = "adult-content"
      definition = "Cualquier contenido sexual, violento o explícito para adultos"
      examples   = ["contenido para adultos", "violencia explícita", "contenido sexual"]
      type       = "DENY"
    }
    topics_config {
      name       = "political-propaganda"
      definition = "Propaganda política o contenido partidista"
      examples   = ["propaganda política", "campaña electoral"]
      type       = "DENY"
    }
    topics_config {
      name       = "personal-data"
      definition = "Solicitar o compartir datos personales de menores"
      examples   = ["dame tu dirección", "cuál es tu número de teléfono"]
      type       = "DENY"
    }
  }

  word_policy_config {
    managed_word_lists_config {
      type = "PROFANITY"
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-guardrail-${var.environment}"
  })
}

resource "aws_bedrock_guardrail_version" "finantutor" {
  guardrail_arn = aws_bedrock_guardrail.finantutor.guardrail_arn
  description   = "Version ${var.environment}"
resource "aws_iam_policy" "apply_guardrail" {
  name        = "${var.project_name}-guardrail-access-${var.environment}"
  description = "Allow applying the Finantutor Bedrock Guardrail"
  policy      = data.aws_iam_policy_document.apply_guardrail.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "apply_guardrail" {
  role       = var.execution_role_name
  policy_arn = aws_iam_policy.apply_guardrail.arn
}
