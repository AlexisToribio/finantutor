# Comprobaciones de la entrega

Fecha: 2026-09-27.

| Componente | Resultado |
|---|---|
| Tutor y runtime | 22 pruebas: cálculos, herramientas, aislamiento de recuperación, contrato MANAGED del SDK y streaming del entrypoint AgentCore |
| Ingesta | 9 pruebas: PDFs, sílabo, documentos no legibles, estado de jobs y fallos duplicados |
| BFF | 12 pruebas: autorización, streaming truncado, referencias, exclusión de turnos, transacciones y PDF real con persistencia tras reinicio |
| Interfaz | 2 recorridos Chromium: escritorio y móvil, carga y mapa, respuesta con cita, matemáticas, progreso y ausencia de desbordamiento horizontal |
| Builds | Frontend y BFF compilan; ZIPs de Lambda generados |
| Código | Ruff, Prettier y Terraform fmt pasan |
| Terraform | Los ocho entornos dev/prod validan con AWS provider 6.65.0 |

La prueba del entrypoint utiliza el servidor real del SDK con generación simulada. Las pruebas de recuperación cloud utilizan Stubber, sin acceso a AWS. El recorrido del navegador utiliza una API simulada; la prueba del BFF sí extrae un PDF real mediante el CLI Python. Las [capturas de escritorio](screenshots/chat-desktop.png) y [móvil](screenshots/chat-mobile.png) contienen una respuesta ilustrativa de la prueba, no una respuesta de Bedrock.

No se ejecutaron Docker Buildx, Terraform apply, autenticación Cognito real, sincronización de Knowledge Base ni invocación de modelos. La comprobación con tus materiales y credenciales AWS vigentes queda pendiente del primer arranque/despliegue.

Para ejecutar los recorridos de navegador en tu máquina:

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:ui
```

En el entorno de esta entrega faltaba `libasound2`; se extrajo temporalmente en `/tmp` para ejecutar Chromium, sin modificar el sistema. Las pruebas del SDK/BFF necesitaron ejecutarse fuera del sandbox porque utilizan sockets locales.
