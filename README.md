# Finantutor

Tutor conversacional para estudiantes de la Maestría en Inteligencia Artificial de la UPC, enfocado en **Modelos financieros y evaluación de proyectos**. El monorepo mantiene cuatro proyectos independientes:

```
finantutor/
  frontend/  # React + Vite: Tutor y Subir material
  backend/   # BFF TypeScript: autenticación, chat y URL de carga firmada
  agents/    # Un tutor Strands en Bedrock AgentCore con búsqueda RAG
  ingest/    # Indexación de PDFs en S3 Vectors
```

El tutor usa un único modelo conversacional y una herramienta para buscar en los materiales del curso. No genera fichas ni documentos. La memoria de AgentCore mantiene el contexto por sesión; DynamoDB conserva el historial que muestra el chat.

## Flujo de materiales

La interfaz permite subir un PDF (máximo 50 MB). El BFF crea una URL firmada y el navegador envía el archivo directamente a S3. Una Lambda de ingesta extrae texto, lo divide en fragmentos, genera embeddings con Titan y los guarda en S3 Vectors bajo el curso fijo. El tutor consulta ese índice y cita el título y la página cuando están disponibles.

## Desarrollo local

Se requieren Node.js/pnpm, Python/uv, AWS CLI, Terraform y acceso AWS a Bedrock, S3 y S3 Vectors. El stack `ingest` debe existir en AWS para probar cargas y consultas RAG.

```bash
# Tutor AgentCore
cd agents
cp .env.example .env
uv sync
uv run agentcore dev

# BFF, en otra terminal
cd backend
cp .env.example .env
pnpm install
pnpm dev

# Frontend, en otra terminal
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

Abre `http://localhost:5173`. El inicio de sesión usa Cognito. El frontend tiene dos secciones: **Tutor** y **Subir material**.

## Modelos

| Uso | Modelo |
| --- | --- |
| Tutor conversacional | Claude Sonnet 4.5 (`MODEL_ID`) |
| Embeddings y búsqueda | Amazon Titan Text Embeddings V2 (`EMBEDDING_MODEL_ID`) |

## Despliegue y destrucción

Desde la raíz del repositorio:

```bash
./scripts/deploy.sh dev
./scripts/destroy.sh dev
```

El despliegue aplica ingestión, configura y publica el runtime del tutor, y luego aplica backend y frontend. La destrucción sigue el orden inverso. Los scripts muestran el comando para invitar usuarios de Cognito al finalizar el deploy.

## Rutas principales del BFF

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Estado del BFF |
| `POST` | `/api/v1/conversations/{sessionId}/messages` | Chat en streaming SSE |
| `GET` | `/api/v1/conversations/{sessionId}/messages` | Historial de la sesión |
| `POST` | `/api/v1/books/uploads` | Solicita URL firmada para subir un PDF |

## Pruebas

```bash
cd agents && uv run pytest
cd ingest && uv run pytest
pnpm --filter backend test
pnpm --filter frontend build
```

Consulta las guías de Terraform de [agents](agents/terraform/README.md), [ingest](ingest/terraform/README.md), [backend](backend/terraform/README.md) y [frontend](frontend/terraform/README.md).
