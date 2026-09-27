# API del BFF

Prefijo `/api/v1`. Autenticación mediante `Authorization: Bearer …`; en CloudFront también `x-authorization`. Modo local exige el token explícito de `.env`. El propietario se obtiene del token, nunca del JSON del navegador.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | Salud sin credenciales |
| GET / POST | `/courses` | Listar / crear curso con `title` |
| PUT | `/courses/:course/outline` | Confirmar `units` y `source_material_id` opcional |
| GET | `/courses/:course/materials` | Catálogo y estado de ingesta |
| POST | `/courses/:course/materials/uploads` | `title`, `filename`, `kind`, `unit`, `size`; devuelve material, URL y headers de PUT |
| GET | `/courses/:course/materials/:material/source` | PDF o redirección firmada tras autorización |
| GET | `/courses/:course/progress` | Actividades del curso |
| GET | `/courses/:course/conversations/:session/messages` | Historial |
| POST | `/courses/:course/conversations/:session/messages` | `{prompt, mode}` → SSE |

`mode`: `explain`, `practice`, `case` o `review`. Curso y sesión son UUID. Cada unidad tiene `title`, `objective` y `source_page` opcional. `kind`: `syllabus` o `theory`. La URL de carga es una capacidad temporal; envía el PDF con exactamente los headers devueltos. Localmente el PUT retorna 202; en AWS S3 retorna su respuesta y EventBridge inicia el procesamiento.

Estados de material: `uploading` → `indexing` → `ready` / `failed`. Si el PUT nunca llega, queda `uploading`; recarga el archivo para crear una nueva solicitud.

Eventos SSE en bloques `data: JSON\n\n`:

```json
{"type":"status","text":"Revisando tu pregunta…"}
{"type":"delta","text":"El VAN representa…"}
{"type":"heartbeat"}
{"type":"done","reply":"Respuesta completa","citations":[],"activities":[],"message_id":"uuid"}
```

`error` cierra el turno sin éxito. No basta el cierre de conexión: solo `done` confirma respuesta guardada. Una cita identifica `source_id`, `material_id`, `version`, `title` y página cuando existe; el texto usa `[[S1]]`. Las referencias se restringen al catálogo del curso.

Errores JSON: `{detail}` con 401 (sesión), 404 (recurso no accesible), 409 (turno concurrente), 413 (tamaño), 422 (entrada inválida) o 500 (error interno). Tras iniciar SSE, los errores viajan como evento `error`.
