# Finantutor Implementation Plan

**Goal:** Chat docente con materiales verificables, cálculo financiero, perfil de curso y progreso.

**Architecture:** Cuatro proyectos hexagonales como Educagent. Un TutorAgent Strands, adaptadores locales y AWS, KB MANAGED y una ingesta determinista. Autorización en el BFF, contexto del curso fijado por servidor.

**Tech Stack:** React/Vite/TypeScript, pnpm, Express, SQLite local/DynamoDB, Python/uv, Strands/AgentCore, pypdf, Terraform.

Implementación en esta sesión; cada tarea produce un componente ejecutable y se valida antes del cierre.

## 1. Workspace y contratos

- [x] Crear `package.json`, `pnpm-workspace.yaml`, `.gitignore`, ejemplos `.env` y `finantutor.code-workspace`.
- [x] Definir `backend/src/domain/contracts.ts`: curso, material, referencias, mensajes, progreso y puertos de repositorio/runtime/archivos.
- [x] Crear proyectos Python con nombres de paquete distintos, `finantutor` y `finantutor_ingest`, para evitar colisiones.

## 2. Dominio financiero y TutorAgent

- [x] Crear `agents/src/finantutor/domain/finance.py` con VAN, TIR, conversión de tasas y sensibilidad.
- [x] Verificar `test/test_finance.py`: VAN conocido; TIR conocida; falta de raíz; ambigüedad de flujos; entradas no finitas; periodicidad.
- [x] Implementar `application/tutor.py`, `domain/ports.py` y adaptadores de recuperación local/Managed KB.
- [x] Implementar streaming real de Strands en `agents/main.py`, memoria por actor y sesión, herramientas acotadas y fuentes verificadas.
- [x] Verificar `test/test_tools.py`: ámbito de búsqueda, fuentes existentes, presupuestos y progreso explícito.

## 3. Ingesta

- [x] Implementar `domain/document.py`, `application/prepare.py`, CLI local y handler AWS.
- [x] Validar firma PDF, tamaño, páginas, extracción legible, checksum, documento y propietario.
- [x] Crear texto por página con metadatos propios; proponer unidades extraídas del sílabo sin inventarlas.
- [x] Verificar `ingest/test/test_prepare.py`: PDF real, documento inválido, texto vacío y headings del sílabo.

## 4. BFF

- [x] Crear repositorios SQLite y DynamoDB; conservar mensajes y cursos por propietario.
- [x] Crear transporte HTTP local/SDK AgentCore y parser SSE con fragmentos UTF-8/CRLF.
- [x] Implementar API cursos, perfil confirmado, materiales, carga y descarga autorizada, chat e historial y progreso.
- [x] Persistir la respuesta solo después de terminal `done` válido y confirmar persistencia antes de enviarlo al navegador.
- [x] Verificar `backend/test/app.test.ts`: aislamiento, estado de carga, archivos, stream truncado y persistencia completa.

## 5. Interfaz

- [x] Crear interfaz editorial de estudio: conversación, biblioteca, mapa del curso y progreso.
- [x] Integrar autenticación local explícita/Cognito; mensajes Markdown y matemáticas; adjuntos con citas.
- [x] Añadir carga con estado consultable, revisión del mapa, conversaciones restaurables y errores recuperables.
- [x] Ejecutar `pnpm --filter frontend build` y revisar accesibilidad y comportamiento responsive.

## 6. Infraestructura y operación

- [x] Crear roots Terraform por componente con entornos dev/prod y módulos reutilizables.
- [x] Preparar KB MANAGED, S3 privado de originales/corpus, ingesta Step Functions con espera/reintentos y estados Dynamo.
- [x] Preparar Cognito/BFF, IAM mínimo, Memory/runtime y CloudFront con streaming/OAC.
- [x] Crear empaquetado y despliegue reproducibles, documentación de variables, orden y restricciones.
- [x] Ejecutar pruebas Python/TypeScript, builds, Terraform fmt/validate y revisión de contratos entre componentes.
- [x] Entregar comandos de arranque y reportar por separado verificaciones locales y servicios AWS pendientes de despliegue.

## Resultado de comprobaciones

22 pruebas del tutor/runtime, 9 de ingesta y 12 del BFF; 2 recorridos de interfaz en Chromium (escritorio y móvil, API simulada). Builds frontend/BFF, lint y formato pasan. Los ocho roots Terraform dev/prod validan; ZIPs preparados. No se ejecutó Docker ni se desplegó o invocó Bedrock.
