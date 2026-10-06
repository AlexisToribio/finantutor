# Presupuesto de tokens y ventana de historial del tutor

## Objetivo

Evitar que las consultas del tutor terminen prematuramente con
`limit_total_tokens`, manteniendo el contexto reciente útil y haciendo observable
el consumo real de cada invocación.

## Alcance

- Aumentar el presupuesto acumulado `total_tokens` de 26.000 a 48.000 tokens por
  invocación.
- Mantener los límites existentes de 8 turnos, 6.500 tokens de salida acumulada,
  4.096 tokens máximos por llamada al modelo y 105 segundos por consulta.
- Configurar una ventana deslizante de 12 mensajes en cada agente de sesión.
- Aplicar la ventana antes de cada llamada al modelo mediante `per_turn=True`.
- Mantener `idleRuntimeSessionTimeout` en 900 segundos y `maxLifetime` en 28.800
  segundos.
- No incorporar resumen automático del historial.

## Diseño

### Presupuesto

`TUTOR_LIMITS` usará `total_tokens: 48000`. Este límite seguirá siendo un tope
blando de Strands por invocación: se comprueba entre ciclos y suma los tokens de
entrada y salida de todas las llamadas al modelo realizadas por esa invocación.

### Gestión del historial

Cada `Agent` se construirá con `SlidingWindowConversationManager` configurado con:

```python
SlidingWindowConversationManager(window_size=12, per_turn=True)
```

Strands aplicará la reducción antes de cada llamada al modelo. La implementación
nativa conservará límites válidos entre mensajes y no separará llamadas de
herramientas de sus resultados. La memoria STM de AgentCore continuará
persistiendo los eventos de la sesión; la ventana controla únicamente el contexto
activo entregado al modelo.

No se usará `SummarizingConversationManager`, por lo que el cambio no añadirá
llamadas al modelo, latencia ni posibles distorsiones de valores financieros.

### Ciclo de vida de AgentCore

La configuración declarada del runtime fijará explícitamente:

- `idle_runtime_session_timeout: 900`
- `max_lifetime: 28800`

Esto conserva el comportamiento efectivo actual y evita depender de defaults
implícitos del servicio.

### Observabilidad

Cada invocación completada o detenida por presupuesto registrará, cuando Strands
los proporcione:

- `input_tokens`
- `output_tokens`
- `total_tokens`
- `cycles`
- `context_size`
- `messages_before`
- `messages_after`

`messages_before` se capturará inmediatamente antes de invocar al agente y
`messages_after` después de finalizar. La diferencia permite observar la poda
realizada por el administrador de conversación. Los mismos campos acompañarán
tanto `agent.invocation.completed` como `agent.invocation.budget_reached` para
permitir comparaciones directas en CloudWatch.

La instrumentación no registrará contenido de prompts, respuestas, resultados de
herramientas ni identificadores sensibles.

## Manejo de errores

La ausencia de métricas parciales no hará fallar una respuesta. Los campos
opcionales se normalizarán a cero o `None`, según corresponda, y se conservará el
comportamiento actual para cancelaciones, timeouts y errores del modelo.

## Pruebas

- Verificar que `TUTOR_LIMITS` contiene 48.000 tokens totales y conserva los demás
  límites.
- Verificar que los eventos de finalización y presupuesto incluyen consumo,
  ciclos, contexto y conteos de mensajes.
- Verificar que el tutor construye el agente con una ventana de 12 mensajes y
  aplicación por turno.
- Verificar que el runtime declara explícitamente idle de 900 segundos y vida
  máxima de 28.800 segundos.
- Ejecutar la suite unitaria de `agents` y las comprobaciones de formato/lint
  disponibles en el proyecto.

## Fuera de alcance

- Resumen automático del historial.
- Memoria de largo plazo o estrategias semánticas.
- Cambios en tamaño o cantidad de fragmentos RAG.
- Cambios en el timeout de la consulta o en el máximo de salida por llamada.
