# Finantutor: alineación con Educagent

Fecha: 2026-09-27. Estado: aprobada por el usuario; implementación en curso.

## Objetivo

Hacer que Finantutor replique la arquitectura, el patrón de despliegue y la ingesta de Educagent para ofrecer un chat a estudiantes de la Maestría en Inteligencia Artificial. El agente es tutor del curso **Modelos financieros y evaluación de proyectos** y responde consultas sobre los temas incorporados a la base de conocimiento del curso. Se conservan únicamente las diferencias de producto acordadas: un agente con prompts propios, sin generación de fichas y una UI de conversación con carga de sílabo y materiales.

El usuario indicó que los recursos AWS existentes están siendo destruidos. Se prepara el código para desplegar la arquitectura alineada desde cero. No se incluye migración en paralelo ni se ejecuta Terraform contra AWS.

Esta propuesta sustituye las decisiones incompatibles de la especificación anterior `2026-09-27-finantutor-design.md`, en particular la Bedrock Managed Knowledge Base, la ingesta mediante Step Functions y las pantallas de mapa/progreso.

## Decisiones de arquitectura

| Área | Diseño |
| --- | --- |
| Organización | Copiar los límites de proyectos, estructura modular, convenciones de configuración, empaquetado y Terraform de Educagent. Mantener nombres y dominio Finantutor. |
| Agente | Un único agente Strands en AgentCore Runtime. El prompt y las instrucciones describen tutoría de finanzas. Las operaciones numéricas deterministas pueden exponerse como herramientas del agente. |
| Fichas | No se generan, guardan, descargan ni muestran fichas. Se retiran los componentes, recursos y endpoints de fichas copiados o presentes en Finantutor. |
| Ingesta | Replicar el flujo de Educagent basado en carga a S3 y Lambda activada por `ObjectCreated` para PDFs en el prefijo de entrada. La Lambda extrae texto, segmenta páginas, genera embeddings Titan y escribe vectores y metadatos en S3 Vectors. |
| Recuperación | El agente genera el embedding de la pregunta, consulta el mismo índice S3 Vectors y presenta referencias que provienen de metadatos de los documentos. Retirar Bedrock Managed Knowledge Base y sus recursos asociados. |
| Backend | Adoptar la separación domain/application/infrastructure de Educagent y sus contratos y manejo HTTP/Lambda. Conservar autenticación, conversaciones, cursos/materiales y capacidad de cargar archivos que requiere Finantutor. |
| Frontend | Adoptar la estructura y prácticas de componentes/features de Educagent. Mantener solo conversación y carga/listado/estado de sílabo y materiales; conservar diseño visual propio de Finantutor. |
| Despliegue | Un script por subproyecto y scripts de raíz para todos los componentes. Desplegar `ingest → agents → backend → frontend`; destruir en orden inverso `frontend → backend → agents → ingest`. Mantener los state keys independientes por entorno como en Educagent. |
| Recursos AWS | S3 para originales, S3 Vectors para índice, Lambda para ingesta, AgentCore Runtime/Memory para el agente, BFF y Cognito, y S3/CloudFront para la UI, usando los módulos y permisos mínimos equivalentes a Educagent. |

## Flujo de carga y recuperación

1. El usuario autenticado solicita cargar un sílabo o material desde la UI.
2. El backend verifica propiedad, tipo y tamaño, registra el estado inicial y entrega URL de carga firmada al bucket privado.
3. El navegador carga el PDF al prefijo de entrada configurado en S3.
4. La notificación de S3 activa la Lambda de ingesta. Esta valida y extrae texto, divide el contenido por página en fragmentos, genera embeddings con Titan y ejecuta `PutVectors` en S3 Vectors con identificador de documento, página, texto fuente y metadatos de curso.
5. La UI consulta el estado del material y distingue carga, procesamiento, listo y error. La carga a S3 no implica que el documento ya sea consultable.
6. Para responder, el único agente embebe la pregunta, filtra la búsqueda por el ámbito autorizado del curso/material cuando corresponda, consulta S3 Vectors y usa fragmentos y citas devueltos por el índice.

La implementación seguirá los límites de tamaño, número de páginas, estrategia de fragmentación, dimensiones y nombres de metadatos de Educagent, adaptándolos solo cuando el esquema de cursos y materiales de Finantutor lo requiera. La Lambda de ingesta debe ser idempotente, registrar errores de extracción/indexación y borrar o sustituir los vectores previos cuando un documento se reemplace o elimine.

La destrucción actual de recursos AWS queda fuera de esta tarea de código. Si los objetos fuente del bucket también se eliminan durante esa destrucción, habrá que volver a cargar los materiales después del nuevo despliegue.

## Capacidades de Finantutor que se conservan

- Tutor conversacional dirigido a estudiantes de la Maestría en Inteligencia Artificial para el curso **Modelos financieros y evaluación de proyectos**.
- Consulta de los temas incorporados a la base de conocimiento del curso; el sílabo y los materiales se cargan como fuentes del curso.
- Referencias a las fuentes recuperadas, incluyendo página cuando el PDF permita identificarla.
- Historial y autenticación que necesita el producto.
- Herramientas numéricas financieras que ya formen parte del tutor, bajo validación determinista; no se amplía el catálogo de herramientas durante la alineación.
- UI enfocada en conversar con el tutor y administrar la carga/estado de los documentos.

El agente no se presenta como asistente financiero general. Basa las respuestas sobre el contenido del curso en materiales recuperados y cita sus fuentes; cuando no encuentre respaldo suficiente en la base, indica esa limitación con claridad.

Se elimina de la UI cualquier navegación o pantalla de progreso, mapa del curso, biblioteca separada u otras capacidades que no sean chat y materiales. Se evita agregar generación de fichas o agentes especialistas.

## Despliegue y destrucción

- `ingest/scripts/deploy.sh` empaqueta la Lambda y aplica los recursos S3/S3 Vectors/ingesta de su propio stack.
- `agents/scripts/deploy.sh` configura el entorno, aplica AgentCore y publica el código del agente.
- `backend/scripts/deploy.sh` aplica y publica el BFF.
- `frontend/scripts/deploy.sh` construye y publica la UI y aplica CDN/hosting.
- `scripts/deploy.sh` prepara el state bucket si falta y llama los cuatro despliegues en el orden indicado.
- Cada subproyecto tiene `destroy.sh`; `scripts/destroy.sh` los invoca en orden inverso. El state bucket se conserva salvo opción explícita equivalente a Educagent.
- La salida final del despliegue incluye el comando de administración para crear el usuario inicial de Cognito, adaptado a los outputs de Finantutor.
- Se eliminan utilidades de despliegue de Finantutor que no existen en Educagent cuando dejen de ser utilizadas. El código de negocio y empaquetado que sí necesite el proyecto permanece dentro de su subproyecto.

No se mantienen scripts de bootstrap separados para la KB administrada, sincronización de corpus por Step Functions ni repetición de ingesta al final del despliegue.

## Documentación

README y guía de despliegue describen la estructura alineada, prerrequisitos, variables, orden de despliegue/destrucción, flujo de carga, estados de documentos, comportamiento de S3 Vectors y comando para crear el primer usuario. La documentación no debe afirmar que la carga ya es consultable hasta que la Lambda confirme la indexación.

## Criterios de aceptación

1. Los cuatro subproyectos conservan el patrón de carpetas y la separación de responsabilidades equivalente a Educagent, usando nombres y modelos de Finantutor.
2. Existe exactamente un agente conversacional de Finantutor, dirigido al curso y estudiantes indicados, y puede recuperar materiales indexados en S3 Vectors.
3. No queda ninguna ruta, prompt, interfaz o recurso para generación/descarga de fichas.
4. Cargar un PDF al flujo de Finantutor produce texto, embeddings y vectores con metadatos de fuente y curso; los errores de procesamiento quedan observables y el estado es visible en la UI.
5. Una respuesta con recuperación cita únicamente páginas y materiales presentes en los resultados del índice.
6. La UI de producción presenta conversación y carga/estado de sílabo/materiales como sus dos áreas principales.
7. Los scripts de raíz despliegan `ingest → agents → backend → frontend`, y destruyen en orden inverso; cada subproyecto puede desplegarse/destruirse aisladamente.
8. Terraform deja de declarar Bedrock Managed Knowledge Base, data source administrado y Step Functions de ingesta para Finantutor; declara S3 Vectors, el bucket fuente y Lambda con permisos acotados siguiendo Educagent.
9. README y documentación coinciden con el flujo y scripts resultantes, sin mencionar recursos o comandos retirados.
10. No se despliegan ni destruyen recursos AWS durante la implementación de código.

## Fuera de alcance

- Ejecutar o verificar la destrucción que el usuario está realizando en AWS.
- Migrar objetos o vectores entre recursos activos; el nuevo índice se construye durante la ingesta posterior al despliegue.
- Añadir fichas, agentes especialistas, evaluadores automáticos o nuevas pantallas de progreso.
- Cambiar el modelo conversacional, salvo que una incompatibilidad técnica con la arquitectura de Educagent lo exija y se documente.

## Referencias

- `/home/alexis/agents/educagent/agents/`
- `/home/alexis/agents/educagent/backend/`
- `/home/alexis/agents/educagent/frontend/`
- `/home/alexis/agents/educagent/ingest/`
- `/home/alexis/agents/educagent/scripts/deploy.sh`
- `/home/alexis/agents/educagent/scripts/destroy.sh`
- Amazon S3 Vectors pricing and API: https://aws.amazon.com/s3/pricing/

## Revisión del usuario

Aprobada. El usuario solicitó continuar con el plan y la implementación.
