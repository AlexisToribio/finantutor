# Terraform — runtime del tutor

Este stack prepara los recursos de Amazon Bedrock AgentCore que necesita **un único agente**: rol de ejecución, guardrail, memoria de corto plazo y log group. El runtime se publica con el CLI `agentcore`; los documentos del curso se guardan e indexan desde `ingest/` en S3 Vectors.

## Despliegue

Requisitos: Terraform, AWS CLI autenticado, `agentcore` y el stack de ingesta aplicado.

Desde `agents/`, ejecuta:

```bash
./scripts/deploy-agentcore.sh dev
```

Usa `prod` para producción. El script aplica Terraform, configura y publica el runtime Finantutor y genera las variables que consume el backend. Para destruir, desde `agents/`:

```bash
./scripts/destroy.sh dev
```

El despliegue requiere el `vector_index_arn` del stack de ingest. El runtime recibe `MODEL_ID`, `VECTOR_BUCKET`, `VECTOR_INDEX`, el guardrail y la memoria desde los outputs Terraform.

## Recursos y permisos

- Un modelo conversacional (`model_id`) para responder como tutor de Modelos financieros y evaluación de proyectos de la maestría en Inteligencia Artificial de la UPC.
- Titan Embeddings, invocado por la ingesta para crear vectores; el runtime solo consulta S3 Vectors.
- Guardrail, AgentCore Memory de corto plazo y CloudWatch Logs.
- El rol del runtime puede invocar el modelo y consultar el índice; no puede escribir vectores ni crear archivos descargables.

El historial visible del chat se conserva en DynamoDB desde el stack `backend/`. No se almacena contenido generado ni hay agentes elaborador, evaluador u orquestador.

## Presupuesto y límites de ejecución

El tutor limita cada respuesta del modelo a 4096 tokens. Cada consulta admite como máximo 8 turnos, 6500 tokens de salida acumulada, 48000 tokens totales y 105 segundos de ejecución. El historial activo usa una ventana proactiva de 12 mensajes. El runtime conserva 900 segundos de idle y una vida máxima de 28800 segundos. El cliente de Bedrock usa timeouts de conexión y lectura de 5 y 45 segundos, respectivamente, con tres intentos adaptativos. El BFF conserva su timeout de 120 segundos.

Los límites acumulados de tokens son preventivos: la última respuesta del modelo puede superar ligeramente el umbral y estos controles no sustituyen el seguimiento real del gasto.

Para ejecutar Terraform manualmente, usa `terraform/environments/dev` o `terraform/environments/prod`, no el directorio raíz de `terraform/`.
