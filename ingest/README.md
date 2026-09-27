# Ingesta de materiales

El subproyecto administra el bucket privado de documentos, el bucket/índice S3 Vectors y la Lambda que indexa los PDFs para el tutor de **Modelos financieros y evaluación de proyectos**.

## Flujo

El BFF registra la carga en DynamoDB y entrega una URL firmada. El navegador escribe en `incoming/<owner>/<course>/<material>/source.pdf`. La notificación de S3 invoca la Lambda, que valida el registro, extrae texto por página con `pypdf`, crea fragmentos, obtiene embeddings `amazon.titan-embed-text-v2:0`, escribe `PutVectors` y actualiza el material a `ready` o `failed`. No se usa Bedrock Managed Knowledge Base ni Step Functions.

Los vectores guardan propietario, curso, material, versión, título, unidad, página y texto fuente. El texto se conserva como metadato no filtrable; la recuperación aplica filtros por propietario y curso.

## Scripts

Desde la raíz del monorepo, ejecuta `./ingest/scripts/deploy.sh dev` o `./ingest/scripts/destroy.sh dev`. La raíz ejecuta este stack como primer paso del despliegue completo y como último paso al destruir. Los entornos `dev` y `prod` utilizan estados Terraform separados.

El worker se empaqueta para Python 3.12 en Linux x86_64. El procesamiento acepta PDF con texto seleccionable dentro de los límites definidos por `application/prepare.py`; no incluye OCR. Una carga que termina en S3 puede seguir en estado `indexing` y no es consultable hasta quedar `ready`.
