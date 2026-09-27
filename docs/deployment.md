# Despliegue en AWS

## Requisitos

- AWS CLI con credenciales activas y permisos para los recursos del proyecto. Para AWS SSO, inicia sesión antes del despliegue.
- Terraform 1.10 o superior, Node.js 24 o superior, pnpm 9.7.1, Python 3.12, `uv`, `zip` y `agentcore` (Starter Toolkit de Python).
- Acceso habilitado en Bedrock para el modelo tutor y Titan Text Embeddings V2 en la región seleccionada. La región predeterminada es `us-east-1`.

Los scripts usan el comando `agentcore` del [Starter Toolkit de Python](https://github.com/aws/bedrock-agentcore-starter-toolkit), igual que Educagent. AWS ahora recomienda su CLI npm `@aws/agentcore` y marca el Starter Toolkit como legado; sus comandos no son intercambiables. Para instalar el CLI que espera este repositorio, usa `uv tool install bedrock-agentcore-starter-toolkit` y evita tener el CLI npm con el mismo nombre en `PATH`.

Instala dependencias desde la raíz:

```bash
pnpm install --frozen-lockfile
uv sync --project agents --frozen
uv sync --project ingest --frozen
```

Si utilizas AWS SSO, autentícate y comprueba la identidad antes de ejecutar el despliegue:

```bash
aws sso login --profile TU_PERFIL
export AWS_PROFILE=TU_PERFIL
aws sts get-caller-identity
```

## Desplegar todo

Desde la raíz del monorepo:

```bash
./scripts/deploy.sh dev
```

Para producción ejecuta `./scripts/deploy.sh prod`. Para usar otra región, por ejemplo `us-west-2`, añade `--region us-west-2`.

El script crea o configura el bucket de estado `finantutor-terraform-state-<entorno>` y ejecuta una vez cada proyecto en este orden:

1. `ingest`: bucket privado de PDFs, S3 Vectors e ingesta Lambda.
2. `agents`: permisos y memoria AgentCore; configura y publica el TutorAgent mediante `direct_code_deploy`.
3. `backend`: BFF, Cognito, DynamoDB y conexión a los recursos ya creados.
4. `frontend`: hosting S3/CloudFront, compilación y publicación de la interfaz.

Al terminar se muestra la URL y un comando `aws cognito-idp admin-create-user` listo para invitar al primer usuario. Sustituye el correo de ejemplo antes de ejecutar el comando. El usuario recibirá una invitación de Cognito para establecer su contraseña.

Cada componente también puede desplegarse de forma independiente con `ingest/scripts/deploy.sh dev`, `agents/scripts/deploy.sh dev`, `backend/scripts/deploy.sh dev` o `frontend/scripts/deploy.sh dev`, respetando el mismo orden porque los componentes posteriores leen los outputs anteriores.

## Flujo de documentos

1. En la aplicación, abre **Sílabo y materiales** y carga un PDF como sílabo o material.
2. El BFF registra el documento y el navegador lo carga directamente al bucket privado con una URL firmada.
3. S3 invoca la Lambda de ingesta para el nuevo objeto. La Lambda extrae texto, genera fragmentos y embeddings Titan, escribe vectores en el índice del curso y actualiza el estado del material.
4. El documento aparece como fuente consultable solo después de que la ingesta termine correctamente y el estado sea `ready`.

Se aceptan PDFs con texto seleccionable, hasta 50 MiB y los límites configurados por el validador. No hay OCR. Los logs del procesamiento están en CloudWatch bajo `/aws/lambda/finantutor-<entorno>-ingest`.

## Destruir recursos

Para eliminar los recursos del entorno y conservar el state bucket:

```bash
./scripts/destroy.sh dev
```

La destrucción procede en orden inverso: frontend, backend, agents e ingest. Para eliminar también el state bucket al final, usa `./scripts/destroy.sh dev --including-state`. El borrado de documentos, conversaciones y recursos es irreversible. No ejecutes ese comando en el entorno equivocado.

Cada subproyecto dispone de su propio `destroy.sh` para operar de forma aislada, siguiendo el mismo orden inverso cuando se destruyan dependencias.

## Alcance de verificación

La implementación de scripts no ejecuta Terraform ni modifica recursos AWS. La primera ejecución requiere revisar los planes/cambios en la cuenta, confirmar permisos y verificar disponibilidad de modelos en la región. La creación de infraestructura no vuelve consultables los PDFs: hay que subirlos después del despliegue y esperar el estado `ready`.
