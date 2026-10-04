# Botón de nueva conversación

## Objetivo

Permitir que el estudiante inicie una conversación vacía sin eliminar el historial de la conversación anterior almacenado en el backend.

## Comportamiento

El encabezado del panel de conversación mostrará un botón secundario **Nueva conversación**. Al pulsarlo, la aplicación generará un UUID nuevo, lo guardará como sesión activa del usuario en `localStorage` y actualizará el estado de React.

El cambio de `sessionId` remontará `ChatPanel` mediante su `key` existente. De este modo, el borrador, los mensajes visibles, los errores y el estado de hidratación se reiniciarán sin introducir una segunda fuente de estado. El nuevo panel consultará el historial del UUID recién creado y mostrará el estado vacío.

La conversación anterior no se eliminará ni modificará en el backend. La recuperación o listado de conversaciones anteriores queda fuera de alcance.

## Componentes y flujo

- `useSessionId` devolverá `sessionId` y `startNewConversation`.
- `startNewConversation` creará y persistirá un UUID para el usuario activo antes de actualizar el estado.
- `App` pasará `startNewConversation` a `ChatPanel` como `onNewConversation`.
- `ChatPanel` mostrará el botón en `panel-head` y lo deshabilitará mientras la conversación esté hidratándose o haya una respuesta pendiente.

No se añadirá un endpoint de borrado ni se cambiará el contrato del backend.

## Seguridad ante estados concurrentes

El botón no podrá accionarse mientras haya una solicitud en curso. Esto evita que una respuesta de la sesión anterior se aplique después de cambiar a la sesión nueva. También permanecerá deshabilitado durante la hidratación inicial.

## Pruebas

- Una prueba de la gestión de sesión verificará que iniciar una conversación genera otro UUID, actualiza el valor persistido y conserva la clave específica del usuario.
- Una prueba de interfaz verificará que el botón llama a `onNewConversation` y respeta su estado deshabilitado durante carga o envío.
- Se ejecutarán todas las pruebas y el build de producción del frontend.

## Criterios de aceptación

1. El botón **Nueva conversación** es visible en el panel del tutor.
2. Al pulsarlo aparece una conversación vacía con un `sessionId` nuevo.
3. Una recarga conserva la conversación nueva como activa.
4. La conversación anterior continúa almacenada en el backend.
5. No se puede iniciar otra conversación mientras se carga o genera una respuesta.
6. No se crean commits.
