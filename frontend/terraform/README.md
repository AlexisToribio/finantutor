# Terraform — frontend

El frontend es una SPA servida desde S3 privado por CloudFront. La interfaz tiene dos apartados: **Tutor** para conversar con el agente y **Subir material** para incorporar un PDF al corpus del curso.

## Despliegue

Desde la raíz del monorepo:

```bash
./scripts/deploy.sh dev
```

Este comando despliega los proyectos en orden y publica el frontend al final. Para publicar solo la interfaz, primero despliega el backend y ejecuta desde `frontend/`:

```bash
./scripts/deploy.sh dev
```

Para destruir todos los recursos: `./scripts/destroy.sh dev` desde la raíz. El script local destruye solo frontend; CloudFront puede tardar varios minutos en eliminarse.

CloudFront entrega la SPA desde el bucket privado y enruta `/api/*` al backend con Origin Access Control. El PDF se carga directamente a S3 usando la URL presignada; después, la ingesta lo fragmenta y actualiza el índice S3 Vectors.

El login usa Cognito. Los tokens se guardan en `sessionStorage`; el navegador llama la API bajo el mismo dominio de CloudFront.
