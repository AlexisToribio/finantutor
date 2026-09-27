# Finantutor

Tutor personal para **Modelos financieros y evaluación de proyectos**, de la maestría en Inteligencia Artificial de la UPC. El contexto docente se construye con el sílabo y los materiales que subas y confirmes. No incluye material oficial ni presume conocer los criterios de tu profesor.

## Qué implementa

- Conversaciones con streaming, historial persistente y cuatro modos: explicación, práctica, casos y repaso.
- PDFs de sílabo y teoría, extracción por página, estados de ingesta y fuentes que se pueden abrir desde la respuesta.
- Mapa del curso editable: las unidades propuestas provienen de encabezados del sílabo y requieren confirmación.
- VAN, TIR, conversión de tasas efectivas y sensibilidad calculados con `Decimal`, fuera del modelo.
- Progreso con tema y evidencia de actividades; sin calificaciones inferidas.
- Desarrollo local con SQLite y PDFs en disco; infraestructura AWS con Cognito, Lambda, AgentCore, Bedrock Managed Knowledge Base, DynamoDB, S3 y CloudFront.

## Estructura

```text
frontend/  React + TypeScript + Vite
backend/   BFF Express + TypeScript; autorización, sesiones y persistencia
agents/    Python + Strands; un TutorAgent y herramientas
ingest/   Python + pypdf; preparación determinista de documentos
```

Cada componente conserva `terraform/modules/` y `terraform/environments/{dev,prod}/`, siguiendo Educagent. [Arquitectura y decisiones](docs/architecture.md), [diagramas HTML y Draw.io](docs/diagrams/README.md), [contrato API](docs/api.md), [operación AWS](docs/deployment.md).

## Arranque local

Requisitos: Node **24**, pnpm **9.7.1**, Python **3.12 o superior**, `uv` y credenciales AWS válidas con acceso al modelo configurado en Bedrock. El modo local también invoca Bedrock; no simula las respuestas.

Desde este directorio:

```bash
pnpm install --frozen-lockfile
uv sync --project agents --frozen
uv sync --project ingest --frozen
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp agents/.env.example agents/.env
```

Configura `AWS_REGION` y `TUTOR_MODEL_ID` en `agents/.env`. Si utilizas un perfil, exporta `AWS_PROFILE` en la terminal del runtime. La región y el identificador deben tener acceso habilitado. No pegues credenciales en los archivos del proyecto.

Abre tres terminales:

```bash
# 1. Runtime; conserva este directorio de trabajo para compartir .local
cd agents
.venv/bin/python main.py
```

```bash
# 2. BFF; desde la raíz de Finantutor
pnpm dev:backend
```

```bash
# 3. Interfaz; desde la raíz de Finantutor
pnpm dev:frontend
```

Abre `http://localhost:5173`. Pulsa **Crear cuaderno** para registrar tu asignatura inicial. Sube un PDF en **Materiales**, espera el estado disponible y revisa **Mapa del curso** antes de confirmarlo. Después pregunta por un tema o pide un ejercicio de VAN con sus supuestos.

`LOCAL_TOKEN` y `VITE_LOCAL_TOKEN` deben coincidir. La autenticación local identifica un estudiante de desarrollo y los servidores escuchan en localhost; producción usa Cognito. Los datos quedan en `.local/`, fuera de Git. Un reinicio durante ingesta local puede dejar el material pendiente: vuelve a cargarlo. El adaptador local busca coincidencias de texto; AWS ofrece recuperación mediante la KB.

### Formatos y límites

PDF con texto seleccionable: máximo 50 MiB, 500 páginas, 100.000 caracteres por página y al menos 20 caracteres en cada página. Se rechazan archivos protegidos, páginas vacías y escaneos; OCR, PPTX, DOCX y XLSX quedan como ampliaciones. Cada nueva carga es una versión independiente e inmutable; no hay borrado ni reemplazo en este MVP.

Tasas como fracciones (`0.10` = 10%), flujos periódicos con inversión inicial en `t=0` y cobros posteriores al final del período. La TIR devuelve ambigüedad cuando los flujos cambian de signo varias veces. No incluye XIRR, impuestos automáticos ni cálculos con fechas irregulares.

## Comprobaciones

```bash
pnpm --filter backend test
pnpm test:ui
pnpm --filter backend build
pnpm --filter frontend build
agents/.venv/bin/python -m pytest agents/test
# Ejecutar con cwd ingest para cargar su paquete editable:
(cd ingest && .venv/bin/python -m pytest test)
agents/.venv/bin/ruff check agents
ingest/.venv/bin/ruff check ingest
terraform fmt -check -recursive .
```

[Resultados y alcance de las comprobaciones](docs/validation.md).

Para detener los procesos locales, ejecuta `scripts/down.sh`. Para empaquetar todos los componentes: `bash scripts/package.sh`. Para desplegar todo en AWS, prepara las credenciales y dependencias indicadas en [la guía de despliegue](docs/deployment.md), confirma la cuenta con `aws sts get-caller-identity` y ejecuta desde la raíz `./scripts/deploy.sh dev`. El script crea o configura el bucket de estado y aplica los stacks en orden; usa `./scripts/deploy.sh prod` para producción. `./scripts/destroy.sh dev` destruye los recursos del entorno y conserva el bucket de estado.
