# Despliegue AWS

## Requisitos

AWS CLI autenticada, acceso al modelo de Bedrock, Terraform >= 1.10, Docker Buildx con ARM64, Node 24/pnpm y Python/uv. El proveedor AWS está fijado a 6.65.0. La arquitectura se preparó para `us-east-1`; verifica la disponibilidad de Managed Knowledge Bases y del modelo antes de usar otra región.

`scripts/deploy.sh` crea un bucket S3 privado de estado Terraform por entorno, región y cuenta (`finantutor-terraform-state-{entorno}-{región}-{cuenta}`). Habilita versionado, cifrado, bloqueo de acceso público y transporte TLS. Necesitas credenciales AWS activas y permisos para identificar la cuenta y crear/configurar buckets S3; el script obtiene el ID con STS. Esto no habilita automáticamente el acceso a modelos de Bedrock.

```bash
scripts/deploy.sh dev
```

Para otra región: `scripts/deploy.sh dev --region us-west-2`. También puedes ejecutar `agents/.venv/bin/python scripts/deploy.py dev --region us-east-1`; esta forma manual conserva confirmación por cada plan, mientras que el wrapper aplica los planes automáticamente.

El script empaqueta las Lambdas y ejecuta en orden:

1. BFF inicial: DynamoDB, Cognito y rol, si todavía no existen.
2. Ingesta: buckets, KB, conector y workflow.
3. Runtime inicial: ECR, rol y memoria, si todavía no existen.
4. Construcción ARM64 y publicación de una imagen con etiqueta única; creación/actualización de AgentCore Runtime.
5. Lambda BFF con ARN del runtime y bucket de documentos.
6. CloudFront y bucket SPA; CORS de documentos restringido al dominio publicado.
7. Build con configuración Cognito, publicación en S3 e invalidación de CloudFront.

El comando Python directo muestra los planes y pide escribir `yes` tras revisar cada plan. `scripts/deploy.sh` aplica automáticamente los planes para completar el despliegue en un solo paso. Los parámetros cruzados se conservan en `deployment.auto.tfvars.json` por componente; no los borres entre despliegues: son necesarios para mantener los recursos opcionales. Los ZIP se construyen con dependencias fijadas; la Lambda Python se empaqueta para Python 3.12 Linux x86_64. El runtime se construye para Linux ARM64. Docker no fue ejecutado durante la entrega.

Crea un usuario en el pool Cognito indicado al final mediante AWS Console o `aws cognito-idp admin-create-user`; el primer acceso permite establecer una contraseña nueva. No hay registro público. En `prod` se utilizan nombres y estados separados; antes de ponerlo a disposición de otras personas, añade alarmas, presupuestos y tu política de retención.

## Operación y límites

- Logs de Lambdas: CloudWatch, retención de 14 días. DynamoDB tiene recuperación a un punto en el tiempo. Los buckets de documentos conservan versiones.
- La ingesta admite texto PDF, no OCR; su sincronización se realiza sobre la fuente compartida. Conflictos entre sincronizaciones se reintentan en Step Functions.
- El runtime tiene un límite de 105 segundos por turno, el BFF de 120 segundos y la ingesta de dos horas por ejecución.
- Los originales se descargan con URL firmada temporal tras comprobar la propiedad del curso. La API transmite PDFs directamente a S3, fuera del límite de cuerpo de Lambda.
- La disponibilidad de servicios, permisos organizativos, acceso al modelo y costes deben comprobarse en tu cuenta. La validación Terraform comprueba la configuración, no ejecuta las APIs AWS.
- El historial durable está en DynamoDB; Memory contiene contexto transitorio. Un fallo tras invocar el modelo puede haber creado eventos de Memory aunque el BFF no haya confirmado una respuesta: la UI conserva la pregunta para reintentar.

No se ejecutó `terraform apply`, no se publicaron imágenes y no se llamó a un modelo de Bedrock en esta entrega.


## Iniciar y eliminar

`scripts/up.sh` inicia runtime, BFF e interfaz en orden y espera sus comprobaciones de salud. `scripts/down.sh` detiene los servicios locales en orden inverso y conserva `.local/`.

Para eliminar automáticamente todos los recursos y datos de un entorno AWS, ejecuta:

    scripts/destroy.sh dev

Sustituye `dev` por `prod` solo cuando quieras eliminar ese entorno. El script obtiene la cuenta desde las credenciales activas y deduce el bucket y el estado del entorno seleccionado. Conserva el bucket de estado para permitir futuros despliegues. Para eliminar también dicho bucket, al final y después de destruir los stacks, usa `scripts/destroy.sh dev --including-state`. Esa opción borra permanentemente el estado Terraform.

El teardown pausa disparadores, detiene workflows e ingestas activas, elimina CloudFront y la API, espera 10 minutos y 30 segundos para que expiren las URLs de carga emitidas, borra todas las versiones S3 y los marcadores, elimina imágenes ECR y destruye los stacks Terraform en orden inverso. El borrado de documentos, conversaciones y progreso es irreversible. No guardes datos que quieras retener solo dentro de este entorno.
