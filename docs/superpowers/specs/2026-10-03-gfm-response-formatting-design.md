# Tablas y listas Markdown en respuestas del tutor

## Objetivo

Las respuestas del tutor deben renderizar tablas y listas correctamente, además del soporte matemático existente.

## Diseño

El frontend ampliará `AgentMarkdown` con `remark-gfm`, sin habilitar HTML crudo. Esto incorpora tablas GFM y conserva el pipeline actual de KaTeX, enlaces seguros e imágenes bloqueadas.

El prompt del tutor exigirá Markdown compatible con GFM: cada fila de tabla irá en su propia línea, la fila separadora será obligatoria y cada elemento de lista tendrá su propio marcador y línea.

Como el modelo puede incumplir el formato de listas y concatenar elementos señalados con emojis, el frontend aplicará una normalización estrecha. Solo transformará una línea cuando comience con `✅` o `⚠️` y contenga al menos dos de esos marcadores; cada segmento se convertirá en un elemento Markdown. Un emoji aislado o incluido en una oración normal permanecerá intacto.

## Pruebas y aceptación

- La interfaz pública `AgentMarkdown({ text })` renderiza una tabla como `<table>` y una lista como `<ul>`.
- La creación de un `TutorAgent` transmite al modelo instrucciones explícitas sobre tablas y listas válidas.
- Una línea con varios elementos `✅` o `⚠️` se renderiza como una lista, sin modificar emojis aislados.
- Fórmulas, enlaces y el resto del Markdown conservan su comportamiento.
- Las pruebas de frontend y agentes, y el build del frontend, terminan correctamente.
