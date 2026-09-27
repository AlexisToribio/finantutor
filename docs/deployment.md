# Despliegue AWS

## Desplegar todo el proyecto

### Requisitos

- AWS CLI con credenciales activas y permisos para los recursos del proyecto. Para AWS SSO, inicia sesión antes del despliegue.
- Terraform 1.10 o superior, Node.js 24 o superior, pnpm 9.7.1, Python 3.12, `uv`, `zip` y el comando `agentcore`.
- Acceso habilitado en Bedrock para los modelos configurados. El despliegue usa `us-east-1` por defecto; comprueba la disponibilidad de Bedrock y Knowledge Bases antes de elegir otra región.

Este repositorio usa la interfaz Python del Starter Toolkit (`agentcore configure` con `--deployment-type direct_code_deploy`). Si aún no tienes esa interfaz, instálala con `uv tool install --python 3.12 bedrock-agentcore-starter-toolkit`. AWS ahora recomienda el nuevo CLI npm `@aws/agentcore`; no lo sustituyas directamente porque sus comandos no son los que invocan estos scripts. Consulta el [aviso y guía de migración de AWS](https://github.com/aws/bedrock-agentcore-starter-toolkit) antes de cambiar de CLI.

Desde la raíz del monorepo, instala las dependencias y prepara los entornos Python:

```bash
pnpm install --frozen-lockfile
uv sync --project agents --frozen
uv sync --project ingest --frozen
```

Si usas AWS SSO, inicia sesión y selecciona el perfil:

```bash
aws sso login --profile TU_PERFIL
export AWS_PROFILE=TU_PERFIL
```

Verifica la identidad AWS activa antes de crear recursos:

```bash
aws sts get-caller-identity
```

Ejecuta el despliegue completo desde la raíz:

```bash
./scripts/deploy.sh dev
```

Para desplegar `prod`, usa `./scripts/deploy.sh prod`. Para cambiar la región: `./scripts/deploy.sh dev --region us-west-2`.

El script raíz crea o configura el bucket de estado Terraform `finantutor-terraform-state-dev` o `finantutor-terraform-state-prod`, y luego coordina los scripts locales de cada proyecto. El bucket S3 tiene nombre global; si ya pertenece a otra cuenta, el despliegue se detiene. Terraform aplica los cambios automáticamente, sin pedir confirmación, en este orden:

1. Backend bootstrap: crea la tabla DynamoDB y Cognito.
2. Ingesta: crea buckets de documentos, Knowledge Base, conector y workflow.
3. Agents: crea el rol y Memory con Terraform, y publica el runtime con AgentCore.
4. Backend completo: conecta el runtime y el bucket de documentos a la Lambda.
5. Frontend: crea CloudFront y el bucket SPA, compila, publica los archivos e invalida la distribución.
6. Ingesta: actualiza CORS para aceptar el dominio del frontend.

Al terminar, el script muestra la URL del sitio y el ID del pool Cognito. Crea usuarios desde la consola de Cognito o con `aws cognito-idp admin-create-user`, usando ese ID. No hay registro público.

Ejemplo para invitar un usuario por correo:

```bash
POOL_ID="$(terraform -chdir=backend/terraform/environments/dev output -raw cognito_pool_id)"
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username docente@escuela.edu \
  --user-attributes Name=email,Value=docente@escuela.edu Name=email_verified,Value=true \
  --region us-east-1
```

También puedes ejecutar un componente cuando sus dependencias ya estén desplegadas. Para reproducir el flujo completo manualmente, conserva este orden y repite ingesta al final para actualizar CORS:

```bash
./backend/scripts/deploy.sh dev --bootstrap
./ingest/scripts/deploy.sh dev
./agents/scripts/deploy.sh dev
./backend/scripts/deploy.sh dev
./frontend/scripts/deploy.sh dev
./ingest/scripts/deploy.sh dev
```

Los valores compartidos entre stacks se guardan en `deployment.auto.tfvars.json` dentro de cada entorno. Los scripts empaquetan sus artefactos; la Lambda de ingesta se construye para Python 3.12 Linux x86_64. AgentCore publica el código mediante `direct_code_deploy`, sin Docker ni una imagen ECR. En `prod` se utilizan nombres y estados separados; antes de habilitarlo para otras personas, configura alarmas, presupuestos y retención de datos.

## Operación y límites

- Logs de Lambdas: CloudWatch, retención de 14 días. DynamoDB tiene recuperación a un punto en el tiempo. Los buckets de documentos conservan versiones.
- La ingesta admite texto PDF, no OCR; su sincronización se realiza sobre la fuente compartida. Conflictos entre sincronizaciones se reintentan en Step Functions.
- El runtime tiene un límite de 105 segundos por turno, el BFF de 120 segundos y la ingesta de dos horas por ejecución.
- Los originales se descargan con URL firmada temporal tras comprobar la propiedad del curso. La API transmite PDFs directamente a S3, fuera del límite de cuerpo de Lambda.
- La disponibilidad de servicios, permisos organizativos, acceso al modelo y costes deben comprobarse en tu cuenta. La validación Terraform comprueba la configuración, no ejecuta las APIs AWS.
- El historial durable está en DynamoDB; Memory contiene contexto transitorio. Un fallo tras invocar el modelo puede haber creado eventos de Memory aunque el BFF no haya confirmado una respuesta: la UI conserva la pregunta para reintentar.

## Iniciar y eliminar

`scripts/up.sh` inicia runtime, BFF e interfaz en orden y espera sus comprobaciones de salud. `scripts/down.sh` detiene los servicios locales en orden inverso y conserva `.local/`.

Para eliminar automáticamente todos los recursos y datos de un entorno AWS, ejecuta:

    scripts/destroy.sh dev

Sustituye `dev` por `prod` solo cuando quieras eliminar ese entorno. El script obtiene la cuenta desde las credenciales activas y deduce el bucket y el estado del entorno seleccionado. Conserva el bucket de estado para permitir futuros despliegues. Para eliminar también dicho bucket, al final y después de destruir los stacks, usa `scripts/destroy.sh dev --including-state`. Esa opción borra permanentemente el estado Terraform.

La raíz delega la destrucción en los proyectos en orden inverso: frontend, backend, agents e ingest. Cada uno limpia sus recursos antes de destruir su stack; ingest pausa los disparadores, detiene workflows e ingestas activas, espera 630 segundos para que expiren las URLs de carga y vacía las versiones S3. Agents elimina el runtime AgentCore por su API y limpia ECR solo si queda un repositorio de un despliegue antiguo con contenedor. El borrado de documentos, conversaciones y progreso es irreversible. No guardes datos que quieras retener solo dentro de este entorno.

## Recuperar una creación fallida del conector de Bedrock

Si Terraform informa `Provider produced inconsistent result after apply` en `aws_bedrockagent_data_source.corpus`, comprueba el estado antes de repetir el despliegue. Bedrock completa valores predeterminados de `connector_parameters` y devuelve la configuración de extracción de imágenes. Finantutor declara esos valores y conserva el orden JSON devuelto por Bedrock porque este atributo se representa como texto; el proveedor tiene un [problema registrado sobre diferencias de orden JSON en este recurso](https://github.com/hashicorp/terraform-provider-aws/issues/50065). El ejemplo vigente del proveedor AWS muestra los mismos parámetros [en su documentación](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagent_data_source).

Primero renueva la sesión AWS si hace falta y comprueba que corresponde a la cuenta correcta:

```bash
aws sso login
aws sts get-caller-identity
```

Mira si Terraform alcanzó a guardar el recurso:

```bash
terraform -chdir=ingest/terraform/environments/dev state list
```

Si aparece `module.stack.aws_bedrockagent_data_source.corpus`, crea un plan nuevo y aplícalo después de revisarlo:

```bash
terraform -chdir=ingest/terraform/environments/dev plan -out=deployment.tfplan
terraform -chdir=ingest/terraform/environments/dev apply deployment.tfplan
```

Si no aparece, busca si Bedrock alcanzó a crear el conector:

```bash
KB_ID="$(terraform -chdir=ingest/terraform/environments/dev output -raw knowledge_base_id)"
aws bedrock-agent list-data-sources \
  --knowledge-base-id "$KB_ID" \
  --region us-east-1 \
  --query "dataSourceSummaries[?name=='finantutor-dev-corpus'].{id:dataSourceId,status:status}" \
  --output table
```

Si ese conector existe y está ausente del estado, impórtalo con el par `ID_DEL_CONECTOR,ID_DE_KB` que devolvió AWS. Esto evita que el siguiente `apply` intente crear un recurso con el mismo nombre:

```bash
terraform -chdir=ingest/terraform/environments/dev import \
  module.stack.aws_bedrockagent_data_source.corpus \
  "ID_DEL_CONECTOR,$KB_ID"
terraform -chdir=ingest/terraform/environments/dev plan
```

Si AWS no devuelve el conector, vuelve a ejecutar el despliegue corregido. Después de resolver la creación de `ingest` por cualquiera de estas vías, ejecuta `scripts/deploy.sh dev` para continuar los componentes posteriores. Revisa el plan antes de aplicarlo; usa `prod` y su KB correspondiente solo si el error ocurrió en ese entorno. No borres el estado ni el conector como método de recuperación.
