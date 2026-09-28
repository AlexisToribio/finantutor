# Terraform — backend

El backend es una Lambda Node 24 protegida por Cognito y CloudFront, con DynamoDB para el historial y permisos de invocación sobre el único AgentCore Runtime del tutor. También crea URLs presignadas para subir PDFs al bucket de materiales; el navegador carga directamente a S3 y la Lambda de `ingest/` los indexa en S3 Vectors.

## Despliegue

Orden recomendado desde la raíz del monorepo:

```bash
./scripts/deploy.sh dev
```

El script raíz despliega ingesta, agente, backend y frontend. Para trabajar solo con el backend, primero deben existir los outputs del runtime y de ingest; luego, desde `backend/`:

```bash
./scripts/deploy.sh dev
```

Para destruir todos los recursos: `./scripts/destroy.sh dev` desde la raíz. El script local del backend destruye solo ese stack.

## API relevante

- `POST /api/v1/chat/stream`: envía la consulta al runtime del tutor.
- `GET /api/v1/conversations/:sessionId/messages`: recupera el historial.
- `POST /api/v1/books/uploads`: crea la carga presignada del PDF y los metadatos mínimos para ingesta.

El backend no genera ni descarga archivos; ofrece el chat y URLs presignadas para subir material del curso.

## Identidad

Cognito está configurado para usuarios invitados. Después del apply, se puede crear un usuario con:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id "$(terraform -chdir=terraform/environments/dev output -raw cognito_user_pool_id)" \
  --username estudiante@correo.edu \
  --user-attributes Name=email,Value=estudiante@correo.edu Name=email_verified,Value=true
```

El primer inicio de sesión solicita definir contraseña. Las variables de Cognito para el entorno local están en `backend/.env`.
