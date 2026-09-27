# Diagramas AWS de Finantutor

> **Artefactos históricos:** se generaron para la arquitectura anterior con Bedrock Managed Knowledge Base y Step Functions. Ya no describen los módulos Terraform ni el flujo desplegable actual. La vista vigente está en [architecture.md](../architecture.md); estos exports requieren regeneración antes de volver a usarse como referencia operativa.

Los diagramas representan la infraestructura y los flujos definidos en el código del monorepo. La generación no consultó recursos de una cuenta AWS ni ejecutó despliegues.

- [HTML interactivo](finantutor-aws.html): vista general del chat, autenticación, persistencia, RAG e ingesta. Incluye zoom, búsqueda, trazado de relaciones, cambio de tema y exportación. Abre el archivo directamente en un navegador; es autónomo. Los textos del proyecto están en español y los controles fijos del visor Archify están en inglés.
- [Draw.io editable](finantutor-aws.drawio): cuatro páginas con símbolos nativos AWS: arquitectura, turno/herramientas del tutor, ingesta y despliegue/destrucción. Abre el archivo en la extensión Draw.io de VS Code, diagrams.net o Draw.io Desktop. Las formas, etiquetas y conexiones son editables.
- [Especificación Archify](finantutor-aws.architecture.json): fuente de la vista general HTML.

Los diagramas siguen mostrando CloudFront, recursos de AgentCore y el bucket de estado, pero sus representaciones de conocimiento e ingesta ya no son vigentes.

## Fuentes del repositorio

| Elemento | Evidencia revisada |
| --- | --- |
| CloudFront, OAC S3/Lambda, `/api*`, SPA | [Terraform CloudFront](../../frontend/terraform/modules/spa-cloudfront/main.tf) |
| Cognito, DynamoDB, Lambda y Function URL IAM | [Terraform del BFF](../../backend/terraform/modules/application/main.tf) |
| Scope, bloqueo de conversación, validación de citas y commit antes de `done` | [Chat](../../backend/src/application/chat.ts) |
| TutorAgent Strands, herramientas, streaming y límites | [Adaptador del agente](../../agents/src/finantutor/infrastructure/agent.py) |
| Estilo docente y reglas de uso de evidencia | [Política del tutor](../../agents/src/finantutor/application/tutor.py) |
| Recuperación por usuario, curso y catálogo | [Retriever](../../agents/src/finantutor/infrastructure/retrieval.py) |
| AgentCore Runtime, memoria de 30 días y rol; el CLI despliega con `direct_code_deploy` | [Terraform de soporte del runtime](../../agents/terraform/modules/tutor-runtime/main.tf) |
| Modelo configurado por defecto | [Variables del runtime](../../agents/terraform/modules/tutor-runtime/variables.tf) |
| S3, S3 Vectors, notificación y Lambda | [Stack de ingesta](../../ingest/terraform/stacks/finantutor-ingest/main.tf) |
| Extracción, embeddings Titan, escritura de vectores y estado | [Worker de ingesta](../../ingest/src/finantutor_ingest/infrastructure/aws.py) |
| Límites PDF y extracción de páginas/sílabo | [Preparación PDF](../../ingest/src/finantutor_ingest/application/prepare.py) |
| Bucket de estado y orquestación por proyectos | [Deploy](../../scripts/deploy.sh), [Destroy](../../scripts/destroy.sh) |

Archify no inserta enlaces de código fijados a un commit porque este checkout no tiene un remoto `origin`; la tabla anterior enlaza al árbol de trabajo vigente.

## Comprobaciones del export histórico

Los registros siguientes corresponden a la versión anterior del HTML/Draw.io y no validan el diagrama actualizado para S3 Vectors.

El HTML pasó **9/9 verificaciones showcase**, con **0 errores y 0 advertencias**. Chromium Headless comprobó contención y legibilidad en 1440×900, 1600×1000, 1920×1080 y 2048×1320. La revisión de las cuatro capturas en claro/oscuro no encontró etiquetas sobre nodos ajenos ni cruces de relaciones; el contenido completo cabe en los tamaños de escritorio comprobados.

| Recibo | Contenido |
| --- | --- |
| [Entrega determinista](finantutor-aws.delivery.json) | SHA-256 y bytes de especificación y HTML; 9 verificaciones de artefacto |
| [Navegador](finantutor-aws.visual-check.json) | Mediciones de los cuatro tamaños y capturas de ambos temas |
| [Capturas](finantutor-aws.visual-check.html) | Hoja de contacto de las cuatro imágenes revisadas |
| [Revisión visual](finantutor-aws.review.json) | Revisión vinculada al SHA-256 del HTML y comprobación de símbolos Draw.io |
| [Validación Draw.io](finantutor-aws.drawio-validation.txt) | XML, IDs, geometrías y referencias de las cuatro páginas |

El XML y los identificadores de símbolos del Draw.io fueron validados. No se hizo una revisión visual dentro del editor Draw.io.
