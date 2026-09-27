# Finantutor: propuesta de arquitectura y alcance

Fecha: 2026-09-27. Estado: aprobado por el usuario; MVP implementado en `finantutor/`.

## Objetivo

Construir un chat agéntico que ayude al estudiante a comprender el curso «Modelos financieros y evaluación de proyectos» de la maestría en Inteligencia Artificial de la UPC. El tutor explica, plantea preguntas, propone ejercicios y revisa procedimientos usando el sílabo y los materiales que suba el estudiante.

El tutor adopta un rol docente. Su conocimiento de la asignatura concreta viene de los documentos; no se presenta como el profesor real ni atribuye criterios a la UPC sin una fuente. Hasta recibir el sílabo, los temas financieros mencionados en esta propuesta son ejemplos de capacidades posibles, no una descripción confirmada del programa.

Supuesto de alcance: uso personal inicialmente, con identidad y propiedad de recursos desde la primera versión. El nombre propuesto para el nuevo proyecto es `finantutor`, como repositorio hermano de `educagent`.

## Decisión principal: un TutorAgent con herramientas

Recomendación: un único TutorAgent implementado con Strands y alojado en Amazon Bedrock AgentCore Runtime. El agente recibe el contexto del curso y del estudiante y decide cuándo recuperar fuentes, consultar el sílabo o ejecutar cálculos.

Ser agéntico significa poder elegir y encadenar herramientas para atender el objetivo del estudiante. No requiere varios agentes.

| Alternativa | Ventajas | Limitaciones | Decisión |
| --- | --- | --- | --- |
| Un TutorAgent con RAG y herramientas de cálculo | Coherencia de la conversación; decisiones flexibles; una sola política pedagógica; menor coordinación | Hay que controlar límites de herramientas y calidad de respuestas | Recomendada |
| Chat RAG con flujo fijo | Implementación más pequeña; comportamiento fácil de inspeccionar | Menor flexibilidad para revisar ejercicios o combinar fuentes y cálculos | Útil para una prueba de búsqueda documental |
| Orquestador y agentes especialistas | Contextos separados para tareas complejas y especialidades; revisión independiente posible | Más llamadas a modelos, coordinación, latencia y evaluación; riesgo de criterios pedagógicos inconsistentes | Reservada para necesidades posteriores demostradas |

En Educagent hay una secuencia de generación, evaluación y publicación de fichas. Finantutor busca una conversación de aprendizaje; no necesita reproducir esos roles. Búsqueda documental, cálculo y persistencia serán herramientas o servicios, no agentes separados.

Una evolución multiagente tendría sentido si se incorporan casos integrales con análisis independientes de un modelo de Excel, discusión financiera y corrección según una rúbrica. Se introduciría un especialista como herramienta, manteniendo al TutorAgent como interlocutor y midiendo la mejora frente a la versión de un agente. Un segundo LLM no sustituye las rutinas de cálculo verificables.

## Monorepo propuesto

```text
finantutor/
  frontend/                 React + Vite + TypeScript; chat, materiales y curso
    src/
    terraform/              S3 de SPA y CloudFront
  backend/                  BFF TypeScript; HTTP/SSE, autenticación e historial
    src/domain/
    src/application/
    src/infrastructure/
    terraform/              Lambda, Cognito y DynamoDB
  agents/                   Python; un TutorAgent, herramientas y política docente
    src/domain/
    src/application/
    src/infrastructure/
    terraform/              IAM del runtime, AgentCore Memory y observabilidad
  ingest/                   Python; validación, catálogo y sincronización de materiales
    src/domain/
    src/application/
    src/infrastructure/
    terraform/              S3 de materiales, KB e ingesta asíncrona
  docs/                     Diseño, decisiones y guía de operación
  scripts/                  Desarrollo, empaquetado y despliegue
  package.json
  pnpm-workspace.yaml
  .gitignore
  README.md
```

Se mantiene el patrón hexagonal y los cuatro proyectos independientes de Educagent. `agents/` conserva su nombre por consistencia aunque empiece con un solo agente. pnpm administra frontend/backend; uv administra cada proyecto Python. Cada componente tiene configuración y artefacto propios. Terraform conserva roots por entorno y state keys independientes.

El backend delega la conversación al runtime y administra identidad, sesiones, metadatos y URLs firmadas. La lógica pedagógica y las herramientas del tutor están en `agents/`. `ingest/` administra la incorporación de materiales. Los adaptadores permiten cambiar la implementación de recuperación sin modificar el dominio docente.

## Componentes AWS y responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| S3 + CloudFront | Servir la interfaz; enrutar `/api` al BFF |
| Cognito | Identificar al usuario y proteger conversaciones y materiales |
| Lambda BFF | HTTP/SSE, historial, configuración del curso y URLs firmadas |
| AgentCore Runtime | Ejecutar el TutorAgent y sus herramientas |
| Amazon Bedrock | Modelo conversacional con buen desempeño en español y razonamiento; ID configurable |
| AgentCore Memory STM | Contexto de conversación por actor y sesión |
| DynamoDB | Historial visible, catálogo de materiales, perfil del curso y progreso explícito |
| S3 de materiales | Originales privados y versiones de documentos |
| Bedrock Managed Knowledge Base | Procesamiento, indexación y recuperación de materiales |
| Ingesta asíncrona | Validación de documentos, sincronización y seguimiento de estados |
| CloudWatch | Errores, duración, uso de herramientas y operación de ingesta/runtime |

La KB completamente administrada es la opción propuesta para reducir operación y utilizar recuperación híbrida y procesamiento documental administrados. No se incorpora un vector store propio por defecto. Los detalles de disponibilidad regional, límites, tarifas, SDK y soporte Terraform se comprueban antes de implementar los recursos correspondientes.

El perfil estructurado del curso y el índice documental tienen funciones diferentes. El sílabo debe poder consultarse por unidad, objetivos y secuencia sin depender solamente de encontrar un fragmento similar en el índice.

## Flujo de incorporación de materiales

1. El estudiante crea el curso y solicita una URL de carga para un documento.
2. El BFF valida identidad, tipo y tamaño permitido; genera un identificador de material y una URL PUT firmada.
3. El navegador sube el archivo directamente a S3. El servidor valida el archivo efectivo, no solo el nombre de la extensión.
4. La ingesta registra versión, checksum, propietario, curso, título, tipo de documento y unidad cuando se conoce. Las unidades desconocidas quedan explícitamente sin asignación.
5. La ingesta sincroniza la fuente de la KB y sigue el trabajo asíncrono hasta completar o fallar. Para esperas y reintentos largos se propone Step Functions con tareas Lambda; la máquina de estados coordina ingesta, no agentes.
6. La UI consulta los estados `uploaded`, `indexing`, `ready` y `failed`. Una aceptación de carga no significa que el contenido ya pueda consultarse.
7. Al incorporar el sílabo, se propone un mapa estructurado de unidades y objetivos que el estudiante revisa antes de considerarlo vigente. La extracción no inventa información ausente.

El MVP prioriza PDF con texto y documentos de teoría. Los documentos escaneados o con fórmulas complejas requieren verificar la extracción antes de habilitar su consulta. PPTX, DOCX y hojas de cálculo se incorporan después según los materiales reales. La lectura de Excel conserva tablas y unidades; no ejecuta macros.

## Comportamiento pedagógico

Modos de interacción: explicar un concepto, practicar, resolver un caso y revisar el procedimiento del estudiante. Son modos del mismo TutorAgent, no roles independientes.

El tutor ajusta el detalle al conocimiento previo, explica variables y supuestos, muestra un ejemplo y comprueba comprensión. Puede relacionar conceptos con proyectos de IA cuando sea útil; distingue los ejemplos creados de las afirmaciones sustentadas en los documentos del curso.

Al revisar un ejercicio, identifica el paso donde aparece el error y propone una pista antes de dar la solución completa, salvo que el estudiante pida explícitamente dicha solución. El sílabo y los materiales tienen prioridad para notación, periodicidad, convenciones y criterios de evaluación.

## Herramientas iniciales del TutorAgent

| Herramienta | Entrada | Resultado |
| --- | --- | --- |
| `get_course_outline` | Unidad opcional; curso fijado por el servidor | Objetivos, temas, secuencia y referencias del sílabo confirmado |
| `search_materials` | Pregunta y unidad/tipo opcionales; propiedad fijada por identidad | Fragmentos con documento, versión, identificador de fuente y localización disponible |
| `calculate_financial_metric` | Operación y parámetros estructurados | Resultado, supuestos, unidades y desglose verificable |
| `get_learning_progress` | Curso fijado por el servidor | Temas estudiados y resultados de actividades registradas |
| `record_learning_activity` | Actividad realizada y resultado explícito | Registro persistido y confirmación |

Las primeras operaciones financieras se elegirán según el sílabo. VAN, TIR, conversión de tasas y sensibilidad son candidatos adecuados para casos iniciales. Se validan signo de flujos, tasa, periodicidad, moneda y supuestos. La TIR devuelve un estado explícito ante falta de solución, soluciones múltiples o no convergencia.

Los cálculos se ejecutan en funciones numéricas con entradas tipadas y casos de referencia. No se interpreta ni ejecuta código arbitrario propuesto por el modelo. El modelo explica los resultados de las herramientas y mantiene las cifras devueltas.

## Flujo del chat

1. El BFF identifica al usuario, valida su acceso al curso y establece la conversación.
2. El runtime recibe el mensaje, contexto del curso, actor y sesión. Las políticas de acceso no proceden del texto del usuario ni del LLM.
3. El TutorAgent interpreta el objetivo y pregunta por datos faltantes cuando son necesarios.
4. Para atribuir una explicación al curso, recupera evidencia. Para resultados numéricos, ejecuta la herramienta financiera.
5. Puede reformular una búsqueda o combinar fuentes y cálculos dentro de un presupuesto acotado de llamadas y tiempo.
6. Explica el resultado, explicita supuestos, adjunta referencias y puede proponer una pregunta de comprensión.
7. El runtime transmite eventos `status`, `delta` cuando el SDK permita texto incremental, `citations`, `done` o `error`. El BFF conserva el historial terminado; los estados parciales no se guardan como una respuesta completa.

La memoria STM conserva continuidad del diálogo. DynamoDB almacena el historial de UI y el progreso confirmado. La base de conocimiento almacena materiales. Se evita usar el historial conversacional como fuente autorizada de teoría del curso.

## Calidad, errores y límites

- Las citas hacen referencia a documentos efectivamente recuperados. Se incluye página o diapositiva solo si esa localización existe en el resultado; no se inventa.
- Si no hay evidencia suficiente del curso, el tutor lo indica y distingue cualquier explicación general que el estudiante solicite.
- Una fuente incompleta, una herramienta fallida o un cálculo no convergente produce un estado explícito, no un resultado fabricado.
- Las instrucciones contenidas en documentos se tratan como contenido, no como órdenes que puedan modificar la política del tutor.
- El acceso a materiales, conversaciones y progreso se filtra por identidad validada en servidor; el LLM no decide autorización.
- Las cargas y la sincronización son idempotentes y los trabajos registran errores y reintentos. Un documento eliminado o reemplazado necesita sincronización antes de dejar de estar disponible en el índice.
- Se establecen límites de tokens, llamadas de herramientas y tamaño de entrada. No se promete una cifra mensual sin volumen de uso y precios verificados.

## Criterios de aceptación del primer producto

1. Crear un curso, cargar un PDF y ver cuándo queda realmente consultable.
2. Revisar el mapa del curso extraído del sílabo antes de usarlo como configuración docente.
3. Consultar un tema y recibir una explicación sustentada con enlaces a sus fuentes.
4. Obtener un resultado financiero reproducible con supuestos y periodicidad visibles.
5. Entregar un procedimiento propio y recibir retroalimentación sobre sus pasos.
6. Continuar una conversación con contexto y consultar su historial.
7. Mostrar errores comprensibles ante extracción fallida, ausencia de evidencia o indisponibilidad del modelo.
8. Verificar aislamiento de recursos y evitar respuestas completas guardadas a partir de streams fallidos.

La evaluación técnica incluirá pruebas de cálculo con valores conocidos, contratos de ingesta/SSE y una colección de preguntas extraídas del material real. Se evaluarán relevancia de recuperación, correspondencia de citas, claridad docente y manejo de preguntas no cubiertas. Un evaluador LLM puede apoyar la evaluación fuera del chat, sin introducir otro agente en cada respuesta.

## Orden de implementación propuesto

1. Crear el monorepo y la estructura hexagonal, configuración local y workspace de VS Code.
2. Implementar el chat de un TutorAgent con streaming e historial.
3. Implementar carga, catálogo, ingesta y recuperación de PDFs con fuentes.
4. Incorporar el perfil de curso/sílabo y las herramientas financieras iniciales.
5. Incorporar práctica guiada y registro de progreso explícito.
6. Verificar calidad con los materiales del curso y preparar infraestructura/despliegue.

El entorno local sigue el esquema de Educagent: frontend Vite, backend HTTP y runtime Python. Los adaptadores de AWS mantienen paridad con el despliegue; la creación de recursos remotos se realiza en un paso explícito posterior.

## Fuentes técnicas consultadas

- Amazon Bedrock Knowledge Bases: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html
- Retrieve y consideraciones de la KB administrada: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html
- Herramientas de Strands: https://strandsagents.com/docs/user-guide/sdk/tools/
- Patrones multiagente de Strands: https://strandsagents.com/docs/user-guide/sdk/multi-agent/multi-agent-patterns/
- AgentCore Memory: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html
- Referencia del proyecto actual: `/home/alexis/agents/educagent/README.md` y sus proyectos frontend/backend/agents/ingest.

## Revisión pendiente

Confirmar el diseño y si el alcance inicial será personal o compartido. El desarrollo utilizará el sílabo que se incorpore como fuente de verdad del temario. Esta propuesta no requiere conocer de antemano el contenido exacto del curso para fijar los límites de arquitectura.
