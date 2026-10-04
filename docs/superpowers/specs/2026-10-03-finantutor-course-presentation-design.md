# Presentación de Finantutor para Modelos financieros y evaluación de proyectos

## Objetivo

Crear una presentación académica de 15 minutos que equilibre dos mensajes:

1. Finantutor aporta valor pedagógico al convertir el sílabo y las clases del curso en una conversación guiada y respaldada por fuentes.
2. Ese comportamiento se implementa con una arquitectura AWS trazable, segura y operable.

La exposición incluye una prueba libre del profesor dentro de los 15 minutos. No se preparará un caso financiero cerrado: antes de exponer se cargarán el sílabo y algunas clases, y Miguel Toribio acompañará al profesor mientras formula sus propias preguntas.

## Audiencia y tono

La audiencia principal es el profesor y los estudiantes del curso **Modelos financieros y evaluación de proyectos**. El lenguaje será académico, directo y accesible: se explicará la tecnología por el valor que aporta al aprendizaje, evitando una enumeración de servicios AWS sin contexto.

La presentación no afirmará que Finantutor sustituye al profesor, califica al estudiante o garantiza exactitud absoluta. Se presentará como apoyo para consultar, comprender, profundizar y practicar sobre el material oficial del curso.

## Integrantes

- Fernández Tacuche, José Wilfredo — E202610265
- Jesus Brian Saenz Chafloque — E202610387
- Romero Montoya, Milton Jhon — E202610467
- Toribio Barrueta, Miguel Alexis — E202610111

Miguel conducirá la demo y apoyará al profesor. El guion propondrá una distribución para los demás bloques, pero se marcará como editable para que el grupo pueda reasignarla sin modificar la narrativa.

## Narrativa y tiempos

La historia seguirá la secuencia **problema pedagógico → experiencia educativa → arquitectura AWS → demo → impacto**.

| # | Diapositiva | Propósito | Tiempo |
|---:|---|---|---:|
| 1 | Finantutor | Presentar proyecto, curso e integrantes | 0:30 |
| 2 | El reto no es encontrar información | Exponer la dificultad de estudiar materiales dispersos | 0:50 |
| 3 | Una conversación basada en el curso | Explicar la propuesta y sus límites | 1:00 |
| 4 | De material estático a aprendizaje activo | Mostrar consultar, profundizar, practicar y contrastar | 1:00 |
| 5 | La arquitectura completa | Recorrer acceso, BFF, AgentCore, Bedrock, memoria y datos | 1:40 |
| 6 | Cómo responde sin perder la fuente | Explicar carga, fragmentación, embeddings, búsqueda y citas | 1:20 |
| 7 | Diseñado para responder con control | Explicar Cognito, Guardrails, IAM y presupuestos de ejecución | 1:00 |
| 8 | Decisiones y aprendizajes | Justificar agente único, RAG y memoria frente a historial | 0:50 |
| 9 | Prueba en vivo | Miguel acompaña la interacción libre del profesor | 4:00 |
| 10 | Tecnología al servicio del aprendizaje | Resumir beneficios, límites y cierre | 0:50 |

El contenido planificado suma 13 minutos. Los 2 minutos restantes son colchón para autenticación, latencia, una repregunta o recuperación ante una incidencia de la demo.

## Sistema visual

La dirección aprobada es **Tecnología académica**, inspirada en el ritmo y claridad de la charla de Educagent, con identidad propia para Finantutor:

- formato 16:9;
- fondos azul noche con acentos cian;
- tipografía grande y alto contraste;
- una idea dominante por diapositiva;
- poco texto visible y desarrollo completo en el guion;
- diagramas limpios, números destacados y transiciones discretas;
- portada y cierre conectados visualmente;
- controles por teclado, indicador de avance, modo pantalla completa y adaptación a resoluciones de proyección.

Los recursos necesarios estarán embebidos o almacenados localmente para que la presentación no dependa de internet. La interfaz real de Finantutor se mostrará durante la demo; las diapositivas no simularán resultados financieros ni conversaciones que no hayan ocurrido.

## Diagramas con Archify

Se utilizará la skill `archify` para producir dos artefactos a partir de evidencia del repositorio:

1. Un diagrama `architecture` de la solución AWS completa.
2. Un diagrama `dataflow` de la ingesta y consulta RAG.

Cada diagrama tendrá una ruta principal evidente, un máximo de 12 nodos primarios y etiquetas semánticas breves. Los candidatos JSON usarán `meta.quality_profile: "showcase"`, se validarán hasta obtener los nueve controles de artefacto sin errores ni advertencias y se entregarán como HTML autocontenido.

Las diapositivas incluirán versiones simplificadas que preserven la semántica y la jerarquía de los diagramas. Los HTML completos quedarán como anexos explorables. El contenido será español; los controles fijos del visor Archify quedarán en inglés porque el runtime no ofrece localización española.

## Contenido por bloque

### Problema y propuesta pedagógica

El problema se formulará como una brecha entre disponer de información y poder aprender activamente con ella. Finantutor permitirá consultar el material oficial, pedir explicaciones, formular preguntas de seguimiento y practicar conceptos, conservando título y página cuando la fuente esté disponible.

### Arquitectura AWS

La explicación seguirá el recorrido del usuario: frontend en S3/CloudFront, autenticación con Cognito, BFF en Lambda, ejecución del tutor en Bedrock AgentCore, inferencia en Amazon Bedrock, contexto de sesión en AgentCore Memory e historial visible en DynamoDB. Se distinguirán claramente memoria de trabajo e historial de aplicación.

### Flujo RAG

La ingesta mostrará la carga directa mediante URL prefirmada, almacenamiento en S3, procesamiento por Lambda, extracción y fragmentación, embeddings con Titan y escritura en S3 Vectors. La consulta mostrará la transformación de la pregunta en embedding, recuperación de fragmentos y generación de una respuesta respaldada por el material.

### Controles y límites

La presentación resumirá autenticación, Guardrails, mínimo privilegio y los límites configurados: 4096 tokens por respuesta, 5 turnos, 6500 tokens de salida acumulada, 26000 tokens totales y 105 segundos por consulta. Se explicarán como controles de costo, latencia y comportamiento, no como garantía de exactitud.

### Demo

La diapositiva de demo ofrecerá tres preguntas sugeridas de distinta profundidad, sin obligar al profesor a usarlas. Miguel verificará previamente sesión, materiales e índice; explicará en una frase qué está viendo el profesor y luego dejará que formule preguntas libres.

Si la demo en vivo no responde, el grupo mostrará una captura local previamente verificada y explicará el flujo esperado sin fingir una ejecución exitosa.

## Guion hablado

El guion Markdown incluirá por diapositiva:

- tiempo parcial y acumulado;
- responsable sugerido;
- objetivo comunicativo;
- texto hablado natural;
- transición hacia la siguiente diapositiva;
- indicaciones no verbales cuando aporten valor.

También incluirá una lista de preparación, preguntas sugeridas para el profesor y un plan de contingencia para autenticación, latencia o falta de resultados relevantes.

## Entregables

- `docs/finantutor-presentacion.html`: presentación autocontenida.
- `docs/README-presentacion-finantutor.md`: guion y operación de la exposición.
- `docs/finantutor-presentacion-aws.architecture.json`: fuente Archify de arquitectura.
- `docs/finantutor-presentacion-aws.html`: arquitectura explorable.
- `docs/finantutor-rag.dataflow.json`: fuente Archify del flujo RAG.
- `docs/finantutor-rag.html`: flujo RAG explorable.
- Sidecars de validación visual generados por Archify para ambos diagramas.

## Validación

- Validar y entregar ambos diagramas con perfil Archify `showcase`.
- Ejecutar `visual-check` sobre los HTML entregados.
- Verificar la presentación a 1440×900, 1600×1000 y 1920×1080 sin desbordamiento horizontal ni vertical.
- Comprobar navegación por teclado, modo pantalla completa, indicador de avance y legibilidad a distancia.
- Revisar que nombres, códigos, servicios AWS, límites y flujo técnico coincidan con el repositorio.
- Ensayar el guion para mantener 13 minutos de contenido y 2 minutos de contingencia.

## Criterios de aceptación

- La presentación comunica con claridad tanto el valor pedagógico como la arquitectura AWS.
- La demo del profesor cabe dentro de los 15 minutos.
- Los cuatro integrantes aparecen correctamente en la portada.
- Miguel figura como conductor de la demo.
- Los diagramas reflejan el código real y superan la validación `showcase`.
- La presentación funciona sin acceso a recursos visuales externos.
- El guion permite repartir la exposición y recuperarse de una demo fallida.
