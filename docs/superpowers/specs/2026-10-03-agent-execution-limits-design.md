# Límites de ejecución del agente de Finantutor

## Objetivo

Acotar el costo y la duración de cada consulta de Finantutor mediante límites explícitos de tokens, turnos y tiempo, siguiendo el mecanismo probado en Educagent y adaptándolo a la arquitectura de un único agente tutor.

## Alcance

El cambio cubre exclusivamente el runtime Python de `agents`:

- límite duro de salida por invocación al modelo;
- presupuestos acumulados de turnos y tokens para el ciclo del agente;
- timeout de pared para la consulta completa;
- timeouts y reintentos del transporte hacia Bedrock;
- registro del motivo de finalización;
- pruebas unitarias y documentación operativa.

No se cambiarán el BFF, el frontend, los prompts, el modelo configurado, la infraestructura desplegada ni los límites de ingestión.

## Configuración acordada

Finantutor tiene un único `TutorAgent`, por lo que usará un solo perfil:

| Control | Valor |
|---|---:|
| Salida máxima por respuesta del modelo | 4096 tokens |
| Turnos por ejecución del agente | 5 |
| Salida acumulada por ejecución | 6500 tokens |
| Tokens totales acumulados por ejecución | 26000 tokens |
| Timeout total de la consulta | 105 segundos |
| Timeout de conexión a Bedrock | 5 segundos |
| Timeout de lectura de Bedrock | 45 segundos |
| Intentos de transporte | 3, modo adaptativo |

El timeout de 105 segundos deja margen antes del timeout de 120 segundos del BFF. Los presupuestos acumulados son preventivos: la última respuesta puede hacer que el consumo observado supere ligeramente un umbral.

## Diseño

### Configuración y carga del modelo

`infrastructure/config/settings.py` expondrá la constante `TUTOR_MAX_OUTPUT_TOKENS = 4096`. `main.py` la pasará a `load_model`, que aceptará `max_tokens` y construirá `BedrockModel` con una configuración de Botocore de 5 segundos de conexión, 45 segundos de lectura y tres intentos adaptativos.

La configuración permanecerá en código, como en Educagent. No se añadirán variables de entorno porque estos valores son límites operativos comunes a todos los despliegues actuales y no existe un requisito para ajustarlos por ambiente.

### Presupuesto del agente

Un nuevo módulo `infrastructure/llm/limits.py` contendrá:

- `TUTOR_LIMITS`, con los presupuestos de turnos y tokens acordados;
- `TUTOR_TIMEOUT_SECONDS = 105`;
- `AgentTimeoutError`, para distinguir un vencimiento del resto de fallos;
- `invoke_agent`, como único punto de aplicación de límites y timeout.

`TutorAgent` recibirá límites y timeout mediante parámetros con valores predeterminados. `composition.py` los inyectará explícitamente para que el ensamblaje de producción sea visible y las pruebas puedan sustituirlos.

### Flujo de ejecución

`TutorAgent.reply` obtendrá o creará el agente de sesión y llamará a `invoke_agent`. El wrapper:

1. establecerá un deadline monotónico para la consulta raíz;
2. pasará `limits` y una señal de cancelación a Strands;
3. cancelará el agente si vence el presupuesto temporal;
4. limpiará siempre timers y variables de contexto, incluso ante excepciones;
5. convertirá una cancelación por tiempo en `AgentTimeoutError`;
6. registrará como advertencia los finales por límite de turnos o tokens y como finalización normal los demás.

El resultado seguirá convirtiéndose a texto y la respuesta pública conservará el contrato actual: `reply` y `session_id`.

## Manejo de errores

El timeout producirá `AgentTimeoutError` y seguirá la ruta de errores ya existente del runtime; no se devolverá una respuesta parcial potencialmente engañosa. Las excepciones de Bedrock, recuperación de documentos y memoria conservarán su comportamiento actual. Los timers y el contexto de cancelación deberán limpiarse mediante `finally` para impedir que una consulta fallida contamine la siguiente.

La política de reintentos se limitará al cliente del modelo Bedrock. No se ampliará en este cambio a S3 Vectors ni Titan embeddings, porque eso excede los límites solicitados y alteraría el comportamiento de la herramienta de búsqueda.

## Compatibilidad

La API de límites utilizada requiere `strands-agents >= 1.56.0, < 2.0.0`. Se actualizarán `pyproject.toml`, `requirements.txt` y `uv.lock` de manera consistente. No cambiarán los contratos del dominio ni del BFF.

## Pruebas

Las pruebas unitarias verificarán que:

- `invoke_agent` entrega a Strands los límites y la señal de cancelación;
- una terminación `cancelled` se traduce en `AgentTimeoutError`;
- el contexto se limpia después de una excepción;
- `load_model` aplica `max_tokens`, timeouts y reintentos adaptativos;
- `TutorAgent` utiliza el wrapper con los límites y timeout inyectados;
- la respuesta exitosa mantiene el formato actual.

Finalmente se ejecutará toda la suite de `agents` para detectar regresiones.

## Criterios de aceptación

- Ninguna respuesta individual puede solicitar más de 4096 tokens al modelo.
- Cada consulta usa los presupuestos 5/6500/26000 de Strands.
- Una consulta que supera 105 segundos cancela el agente y termina con `AgentTimeoutError`.
- El cliente Bedrock usa timeouts 5/45 y tres intentos adaptativos.
- Los motivos de parada por presupuesto quedan registrados.
- Las pruebas nuevas y la suite existente pasan.
