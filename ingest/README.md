# Ingesta de materiales

La ingesta recibe PDFs del curso **Modelos financieros y evaluación de proyectos**, extrae el texto, lo divide en fragmentos, genera embeddings con Titan y guarda los vectores en S3 Vectors para que el tutor pueda consultarlos.

- La carga llega a `incoming/` del bucket privado mediante una URL presignada.
- La Lambda procesa el PDF y lo archiva en `books/`.
- Los fragmentos llevan el identificador fijo del curso, título, página y texto fuente.
- El índice vectorial se consulta durante la conversación; la ingesta solo procesa e indexa los materiales cargados.

El despliegue de la ingesta es parte de `./scripts/deploy.sh dev` desde la raíz. También puede desplegarse desde `ingest/` con `./scripts/deploy.sh dev`. Para los comandos Terraform y el orden de dependencias, consulta [terraform/README.md](terraform/README.md).
