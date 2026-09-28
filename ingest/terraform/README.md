# Terraform — ingest

Dueño del corpus RAG: bucket de PDFs (CORS PUT), índice S3 Vectors, Lambda Python y notificación `incoming/*.pdf`.

```
terraform/
  modules/
    teacher-books-s3/          # PDFs, CORS PUT
    teacher-books-s3vectors/   # índice; sin QueryVectors (eso es AgentCore)
    books-ingest-lambda/       # Python 3.13, 2048 MB, 900 s
  stacks/finantutor-ingest/
  environments/
    dev/
    prod/
```

State: bucket `finantutor-terraform-state-dev`, key `finantutor/dev/ingest.tfstate` (prod uses matching `prod` path).

El pin de Terraform/AWS vive solo en `environments/*/versions.tf`. En cada módulo (y environment): `main.tf` son `resource` o `module`; `data.tf` son `data` y `locals`.

Orden: **este apply → agents apply → agentcore deploy → backend apply → frontend apply**. Destroy inverso: `./scripts/destroy.sh dev` (vacía el bucket de PDFs y hace `terraform destroy`).

Si el bucket y el índice ya existían en el stack agents, el próximo apply de agents los destruye. Aplica este stack **antes** (recrea vacíos). Si hay PDFs indexados, no applies a ciegas.

## Apply / código

Desde `ingest/`:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh dev
```

Empaqueta `dist/ingest.zip` (`pypdf` + boto3; sin fpdf2/Strands) y hace `terraform apply`. Placeholder si falta el zip.

Este stack no lee remote state. `agents/` y `backend/` leen `finantutor/{dev,prod}/ingest.tfstate`.

## IAM de la Lambda

- `s3:GetObject` / `s3:DeleteObject` en `incoming/*`
- `s3:PutObject` en `books/*`
- `s3vectors:PutVectors` / `s3vectors:GetIndex` en el índice
- `bedrock:InvokeModel` solo Titan embed
- Logs 7 días

El rol de AgentCore no tiene `PutVectors`. El BFF no tiene Titan ni Vectors.
