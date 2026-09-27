# Despliegue AWS

## Requisitos

AWS CLI autenticada, acceso al modelo de Bedrock, Terraform >= 1.10, Docker Buildx con ARM64, Node 24/pnpm y Python/uv. El proveedor AWS está fijado a 6.65.0. La arquitectura se preparó para `us-east-1`; verifica la disponibilidad de Managed Knowledge Bases y del modelo antes de usar otra región.

Crea o proporciona un bucket S3 privado de estado Terraform con versionado, cifrado y acceso a locks S3. El script no crea el bucket de estado ni modifica la cuenta para habilitar modelos. Cada entorno utiliza cuatro claves de estado independientes.

```bash
python3 scripts/deploy.py dev --state-bucket TU_BUCKET_DE_ESTADO --region us-east-1
```

El script empaqueta las Lambdas y ejecuta en orden:

1. BFF inicial: DynamoDB, Cognito y rol, si todavía no existen.
2. Ingesta: buckets, KB, conector y workflow.
3. Runtime inicial: ECR, rol y memoria, si todavía no existen.
4. Construcción ARM64 y publicación de una imagen con etiqueta única; creación/actualización de AgentCore Runtime.
5. Lambda BFF con ARN del runtime y bucket de documentos.
6. CloudFront y bucket SPA; CORS de documentos restringido al dominio publicado.
7. Build con configuración Cognito, publicación en S3 e invalidación de CloudFront.

Cada apply requiere escribir `yes` tras revisar el plan. Los parámetros cruzados se conservan en `deployment.auto.tfvars.json` por componente; no los borres entre despliegues: son necesarios para mantener los recursos opcionales. Los ZIP se construyen con dependencias fijadas; la Lambda Python se empaqueta para Python 3.12 Linux x86_64. El runtime se construye para Linux ARM64. Docker no fue ejecutado durante la entrega.

Crea un usuario en el pool Cognito indicado al final mediante AWS Console o `aws cognito-idp admin-create-user`; el primer acceso permite establecer una contraseña nueva. No hay registro público. En `prod` se utilizan nombres y estados separados; antes de ponerlo a disposición de otras personas, añade alarmas, presupuestos y tu política de retención.

## Operación y límites

- Logs de Lambdas: CloudWatch, retención de 14 días. DynamoDB tiene recuperación a un punto en el tiempo. Los buckets de documentos conservan versiones.
- La ingesta admite texto PDF, no OCR; su sincronización se realiza sobre la fuente compartida. Conflictos entre sincronizaciones se reintentan en Step Functions.
- El runtime tiene un límite de 105 segundos por turno, el BFF de 120 segundos y la ingesta de dos horas por ejecución.
- Los originales se descargan con URL firmada temporal tras comprobar la propiedad del curso. La API transmite PDFs directamente a S3, fuera del límite de cuerpo de Lambda.
- La disponibilidad de servicios, permisos organizativos, acceso al modelo y costes deben comprobarse en tu cuenta. La validación Terraform comprueba la configuración, no ejecuta las APIs AWS.
- El historial durable está en DynamoDB; Memory contiene contexto transitorio. Un fallo tras invocar el modelo puede haber creado eventos de Memory aunque el BFF no haya confirmado una respuesta: la UI conserva la pregunta para reintentar.

No se ejecutó `terraform apply`, no se publicaron imágenes y no se llamó a un modelo de Bedrock en esta entrega.
