# Presupuesto del tutor y fallback de respuestas vacías

## Objetivo

Dar al tutor margen suficiente para buscar materiales y redactar una respuesta, e impedir que una respuesta vacía se envíe o almacene como exitosa.

## Presupuesto del agente

El límite `TUTOR_LIMITS.turns` aumentará de 5 a 8. Los límites de 6500 tokens de salida, 26000 tokens totales y 105 segundos permanecerán sin cambios, por lo que seguirán acotando longitud, costo y duración.

Alcanzar cualquier límite seguirá produciendo telemetría `agent.invocation.budget_reached`. Un límite alcanzado no se considerará por sí mismo un error si el agente ya produjo texto útil.

## Invariante de respuesta

El backend será la autoridad del contrato: un mensaje del agente con cuerpo vacío o compuesto solo por espacios nunca tendrá estado `ok`.

Cuando AgentCore emita un evento `done` sin una respuesta utilizable, `PostConversationMessage` lo reemplazará antes de entregarlo al cliente por:

```json
{
	"type": "done",
	"reply": "El tutor no respondió. Inténtalo de nuevo."
}
```

El backend persistirá el mensaje con ese cuerpo y `status: "error"`. La transformación conservará los demás campos seguros del evento, incluido `session_id`.

## Compatibilidad con historial existente

La serialización HTTP del historial devolverá el fallback tanto para mensajes con estado `error` como para mensajes del agente cuyo cuerpo esté vacío. Esto corrige visualmente los registros vacíos ya almacenados sin requerir una migración de DynamoDB.

El frontend mantendrá una defensa final: al recibir en vivo o hidratar un turno del agente con texto vacío, mostrará el mismo mensaje de fallback. Esta defensa no sustituye la validación del backend.

## Errores y eventos

Las excepciones y eventos `error` conservarán su comportamiento actual. La normalización nueva se limita a eventos `done` con `reply` ausente, no textual o vacío tras aplicar `trim()`.

## Pruebas

- Agentes: `TUTOR_LIMITS` expone 8 turnos.
- Backend: un `done` vacío se envía como fallback y se persiste con estado `error`.
- Backend: un mensaje histórico vacío del agente se serializa como fallback.
- Frontend: respuestas en vivo e históricas vacías se convierten en fallback.
- Las suites afectadas y los builds de producción deben finalizar correctamente.

## Criterios de aceptación

1. El tutor dispone de 8 turnos internos.
2. Ningún `done` vacío llega como respuesta vacía al navegador.
3. Ninguna respuesta vacía nueva se persiste con estado `ok`.
4. Las respuestas vacías históricas muestran el fallback tras recargar.
5. Las respuestas no vacías y los errores existentes conservan su comportamiento.
6. No se crean commits.
