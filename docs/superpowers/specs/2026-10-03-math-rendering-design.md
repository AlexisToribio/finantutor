# Renderizado de fórmulas matemáticas en el chat

## Objetivo

Las respuestas del tutor deben mostrar expresiones LaTeX como fórmulas matemáticas, tanto en línea con `$...$` como en bloque con `$$...$$`, sin afectar el Markdown existente.

## Causa

`AgentMarkdown` procesa las respuestas únicamente con `react-markdown`. Ese paquete no interpreta por sí solo la sintaxis matemática, por lo que los delimitadores y comandos LaTeX se muestran como texto.

## Diseño

`AgentMarkdown` seguirá siendo el único límite de renderizado de respuestas del tutor. Se añadirá `remark-math` a la fase de análisis de Markdown y `rehype-katex` a la fase de generación HTML. Los estilos oficiales de KaTeX se cargarán desde el bundle del frontend.

No se habilitará HTML crudo procedente de las respuestas. La política actual para enlaces e imágenes se conservará: los enlaces se abrirán de forma segura en otra pestaña y las imágenes del contenido continuarán ocultas.

El backend, el protocolo SSE, el almacenamiento de conversaciones y el prompt del agente quedan fuera de alcance. Las respuestas ya almacenadas se beneficiarán del renderizado nuevo al volver a mostrarse.

## Interfaz y comportamiento

La interfaz pública continúa siendo `AgentMarkdown({ text })`.

- `$VAN > 0$` genera una fórmula en línea.
- `$$VAN = -I_0 + \\sum_{t=1}^{n} \\frac{FC_t}{(1+r)^t}$$` genera una fórmula en bloque.
- El Markdown común mantiene su comportamiento actual.
- Una fórmula inválida no debe bloquear el resto de la respuesta; KaTeX mostrará su indicación de error dentro del contenido.

## Pruebas

La prueba se realizará en el límite público del componente y comprobará una respuesta representativa que incluya fórmula en línea y en bloque. Las aserciones observarán la salida accesible/renderizada de KaTeX, no detalles internos de los plugins.

También se ejecutarán las pruebas existentes y el build de producción para validar tipos, CSS y empaquetado.

## Dependencias y empaquetado

Se añadirán `remark-math`, `rehype-katex` y `katex` como dependencias del frontend. La regla de partición de Vite agrupará estas dependencias con el chunk de Markdown para conservar la carga diferida que ya aplica `ChatPanel`.

## Criterios de aceptación

1. Las fórmulas inline y en bloque no muestran sus delimitadores literales.
2. La fórmula de VAN proporcionada se presenta con fracción, sumatoria, subíndices y superíndices.
3. El texto y Markdown circundantes siguen siendo legibles.
4. No se habilita HTML arbitrario en respuestas del agente.
5. Las pruebas del frontend y el build de producción finalizan correctamente.
