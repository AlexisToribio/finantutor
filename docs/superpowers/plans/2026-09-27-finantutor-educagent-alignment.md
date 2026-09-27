# Finantutor Educagent Alignment Implementation Plan

> **For agentic workers:** Execute the tasks sequentially in this plan. Keep each component's Terraform state and deployment scripts isolated by environment.

**Goal:** Replicate Educagent's architecture, S3 Vectors ingestion, and deployment lifecycle in Finantutor for one course tutor, with no fichas and a two-area chat/materials UI.

**Architecture:** Adapt Educagent's four-project monorepo patterns. Ingest PDFs from private S3 with an S3 notification invoking a Lambda that extracts, chunks, embeds with Titan, and writes to S3 Vectors; the single AgentCore tutor retrieves from that index. The TypeScript BFF owns authentication, course/material records, presigned uploads, and conversations; the frontend exposes chat and syllabus/material management.

**Tech Stack:** React, Vite, TypeScript, Express, AWS Lambda, DynamoDB, S3, S3 Vectors, Cognito, Bedrock Titan Text Embeddings, Strands Agents, Bedrock AgentCore, Terraform, pnpm, uv.

---

## File map

| Project | Files and responsibility |
| --- | --- |
| Ingest application | `ingest/src/finantutor_ingest/application/prepare.py`, `domain/document.py`, and `infrastructure/aws.py`: validate PDF, extract pages, chunk text, embed, write S3 vectors, update material state. |
| Ingest deployment | `ingest/terraform/environments/{dev,prod}/main.tf`, outputs and variables; new `teacher-books-s3`, `teacher-books-s3vectors`, `books-ingest-lambda` modules and a `finantutor-ingest` stack: private source bucket, vector bucket/index, Lambda, notification, roles, outputs. |
| Agent | `agents/src/finantutor/infrastructure/retrieval.py`, `agent.py`, `application/tutor.py`, `main.py`: S3 Vectors retrieval, tutor prompt, tool wiring, AgentCore entry point. |
| Agent infrastructure | `agents/terraform/modules/tutor-runtime/*`, `agents/terraform/environments/{dev,prod}/*`, `agents/scripts/{deploy.sh,destroy.sh,package.sh}`: runtime IAM for model, memory and vector reads; direct-code AgentCore deploy matching Educagent. |
| Backend | `backend/src/domain/contracts.ts`, `application/chat.ts`, `infrastructure/{app.ts,composition.ts,files.ts,runtime.ts,store.ts,lambda.ts}` and `backend/terraform/modules/application/*`: authenticated courses/materials, upload state, chat/history, DynamoDB and HTTP/Lambda composition. |
| Frontend | Replace monolithic `frontend/src/App.tsx` responsibilities with `frontend/src/app/*`, `frontend/src/features/chat/*`, `frontend/src/features/materials/*`, `frontend/src/shared/*`; split `frontend/src/styles.css` into focused styles matching Educagent's layout. |
| Deployment and docs | Root `scripts/{deploy.sh,destroy.sh}`; per-project `*/scripts/{deploy.sh,destroy.sh}`; `README.md`, `docs/{architecture.md,deployment.md,api.md,validation.md}` and `ingest/README.md`. Remove only deployment/ingestion helpers made obsolete by the replacement. |

## Task 1: Replace managed-KB worker with direct S3 Vectors ingestion

**Files:**
- Modify `ingest/src/finantutor_ingest/application/prepare.py`
- Modify `ingest/src/finantutor_ingest/infrastructure/aws.py`
- Modify `ingest/src/finantutor_ingest/domain/document.py`
- Modify `ingest/pyproject.toml` and `ingest/requirements.txt` only if dependency changes are required
- Modify `ingest/scripts/package.sh` and remove `ingest/scripts/drain.py` if no remaining caller uses it

- [ ] Replace corpus-object creation and `StartIngestionJob`/`GetIngestionJob` polling with one idempotent S3 event handler that reads the uploaded source PDF, uses the existing PDF checks, extracts page text, chunks pages, generates Titan embeddings, writes `PutVectors` batches, and changes the material DynamoDB row from `uploaded` to `ready` or `failed`.
- [ ] Store `owner_id`, `course_id`, `material_id`, `version`, `title`, `page`, and `source_text` in each vector's metadata; use a stable vector key derived from material id, version, page, and chunk number so retrying the same S3 event overwrites the same vectors.
- [ ] On a replacement upload, remove vectors for the previous version using the material's known vector keys before marking the new version ready; do not use broad unscoped vector deletion.
- [ ] Match Educagent's batch size, chunk overlap, S3 event prefix/suffix filters, Lambda timeout, memory, and status/logging conventions; retain Finantutor's PDF max size/page count and owner/course metadata.
- [ ] Remove `StepFunctions`, Bedrock KB sync, and corpus-bucket variables from the worker and package. Keep source PDFs in one private bucket and do not create a second processed-corpus bucket.
- [ ] Update package dependencies and lockfile only when the resulting runtime imports require it; don't regenerate unrelated package metadata.

## Task 2: Rebuild ingestion Terraform around S3 Vectors

**Files:**
- Replace `ingest/terraform/modules/knowledge/` with focused modules:
  - `ingest/terraform/modules/teacher-books-s3/{main.tf,variables.tf,outputs.tf}`
  - `ingest/terraform/modules/teacher-books-s3vectors/{main.tf,variables.tf,outputs.tf}`
  - `ingest/terraform/modules/books-ingest-lambda/{main.tf,data.tf,variables.tf,outputs.tf,placeholder/ingest.py}`
- Create `ingest/terraform/stacks/finantutor-ingest/{main.tf,variables.tf,outputs.tf}`
- Modify `ingest/terraform/environments/dev/{main.tf,variables.tf,outputs.tf,terraform.tfvars}` and matching `prod` files
- Modify `ingest/scripts/deploy.sh` and `ingest/scripts/destroy.sh`

- [ ] Copy the three Educagent ingestion modules and stack as the starting implementation, then set Finantutor names, runtime environment variables, tags and state outputs.
- [ ] Provision one versioned, encrypted, non-public S3 source bucket with CORS for the frontend's presigned PUT; provision an S3 vector bucket and float32 cosine index with the same dimensions and source-text metadata behavior as Educagent.
- [ ] Give the ingestion role read access to only `incoming/` in the source bucket, `PutVectors`/`DeleteVectors` on only this vector index, Bedrock `InvokeModel` for the configured Titan embedding model, DynamoDB `GetItem`/`UpdateItem` for the Finantutor app table, and scoped CloudWatch log permissions.
- [ ] Invoke the worker directly from S3 `ObjectCreated` for `incoming/*.pdf`; remove EventBridge state-machine execution, Step Functions, KB role, KB data source and corpus bucket resources.
- [ ] Expose only the source bucket name, vector bucket/index names and ingestion Lambda name needed by backend and agent stacks. Delete knowledge-base ID/ARN and workflow outputs and input variables.
- [ ] Keep separate dev/prod state keys and use the existing state bucket; do not import or mutate remote state as part of code changes.

## Task 3: Point the single tutor agent at S3 Vectors

**Files:**
- Modify `agents/src/finantutor/infrastructure/retrieval.py`
- Modify `agents/src/finantutor/infrastructure/agent.py`
- Modify `agents/src/finantutor/application/tutor.py` and `agents/main.py` only where agent wiring or prompt requires it
- Modify `agents/terraform/modules/tutor-runtime/{main.tf,variables.tf,outputs.tf}`
- Modify `agents/terraform/environments/{dev,prod}/{main.tf,variables.tf,outputs.tf,terraform.tfvars}`
- Modify `agents/scripts/{deploy.sh,destroy.sh,package.sh}` and remove unused `agents/scripts/agentcore-yaml.py` helpers if the Educagent deploy path makes them obsolete

- [ ] Replace `ManagedKnowledgeRetriever` with a boto3 `s3vectors` adapter that embeds the query with Titan, calls `QueryVectors`, applies owner/course/material filters from trusted server-provided scope, and maps results into the tutor's existing source/citation contract.
- [ ] Keep exactly one Strands tutor agent. Retain the current finance tutoring and deterministic calculation tools; remove any tool or prompt behavior that generates or publishes fichas.
- [ ] Inject vector bucket/index and embedding model IDs into the local and AgentCore compositions; remove `KNOWLEDGE_BASE_ID` and knowledge-base ARN configuration.
- [ ] Replace `bedrock:Retrieve` permission with scoped `s3vectors:QueryVectors` on the Finantutor index and `bedrock:InvokeModel` for the embedding model; keep model invocation and AgentCore Memory permissions.
- [ ] Adapt Educagent's runtime packaging and `agentcore configure/deploy` calls to the Finantutor package entrypoint and AgentCore runtime name, retaining any Finantutor model and Memory settings that are still required.
- [ ] Remove KB Terraform inputs/outputs and stop calling `ingest` Terraform outputs for KB identifiers.

## Task 4: Align backend boundaries and file lifecycle

**Files:**
- Modify `backend/src/domain/contracts.ts`
- Modify `backend/src/application/chat.ts`; create focused upload/state use cases under `backend/src/application/` if they clarify a single responsibility
- Refactor `backend/src/infrastructure/app.ts` into focused route modules under `backend/src/infrastructure/http/`
- Modify `backend/src/infrastructure/{composition.ts,files.ts,runtime.ts,store.ts,auth.ts,lambda.ts}`
- Modify `backend/terraform/modules/application/*` and `backend/terraform/environments/{dev,prod}/*`
- Remove API contracts and storage fields used only by map/progress/ficha features after confirming no remaining caller

- [ ] Preserve Finantutor's authenticated course creation, material upload/list/source endpoints, message history and SSE chat contract; use the same ports/adapters and dependency composition approach as Educagent.
- [ ] Keep all owner/course authorization in the BFF; derive vector filters and S3 object keys from verified owner/course/material records, never from model-provided values.
- [ ] Replace Step Functions start/poll status handling with the direct S3 event lifecycle: the upload endpoint records `uploaded`, the worker records `ready`/`failed`, and a material status endpoint returns the persisted state.
- [ ] Set S3 CORS from the deployed frontend origin in the ingest stack before frontend uploads; remove the extra post-frontend reapply step and any root-level bootstrap path that is absent from Educagent.
- [ ] Match Educagent's Lambda response and HTTP adapter behavior for non-streamed API requests and chat streaming; retain Finantutor's SSE event names and only the CloudFront response configuration required by the proven Educagent pattern.
- [ ] Keep request/error logs with request IDs and safe error summaries from the existing local edits; do not claim CloudFront behavior is fixed without live AWS verification.
- [ ] Remove only endpoints, domain types, DynamoDB fields, and IAM actions made unreachable by removing the syllabus outline/progress/ficha screens and managed KB workflow. Keep course and material ownership records.

## Task 5: Organize the two-area student UI

**Files:**
- Replace `frontend/src/App.tsx` with `frontend/src/app/App.tsx` and a `frontend/src/app/layout/` shell modeled on Educagent
- Create `frontend/src/features/chat/{ChatPanel.tsx,useChatSession.ts}`
- Create `frontend/src/features/materials/{MaterialsPanel.tsx,useMaterialUpload.ts}`
- Create `frontend/src/shared/api/{http.ts,chat.ts,materials.ts,errors.ts,sse.ts}` as needed
- Move auth and session concerns to `frontend/src/shared/auth/` and `frontend/src/shared/session/`
- Split styles out of `frontend/src/styles.css` into `frontend/src/styles/{tokens.css,layout.css,chat.css,materials.css,login.css,index.css}`

- [ ] Start from the user's current simplified Finantutor UI (chat and syllabus/materials only), then split it into focused features and shared API/auth modules using Educagent's frontend structure.
- [ ] Preserve the Finantutor two-area navigation and visual identity; don't add the Educagent book catalog, grade/subject navigation, ficha view, course map, or progress dashboard.
- [ ] Keep upload progress, ingestion state, citations with page and source links, the user's chat history, Cognito auth and local-development auth behavior.
- [ ] Update frontend API types and calls to use the direct ingestion status lifecycle without Step Functions-specific states or knowledge-base terminology.
- [ ] Keep the mobile navigation at two areas and make status/errors visible next to the relevant material and conversation.

## Task 6: Simplify project and root deployment scripts

**Files:**
- Align `ingest/scripts/{deploy.sh,destroy.sh,package.sh}`
- Align `agents/scripts/{deploy.sh,destroy.sh,package.sh}`
- Align `backend/scripts/{deploy.sh,destroy.sh,package.sh}`
- Align `frontend/scripts/{deploy.sh,destroy.sh}`
- Replace root `scripts/common.sh`, `scripts/deploy.sh`, and `scripts/destroy.sh` with the small Educagent orchestration pattern
- Remove root Python helpers and scripts that become unreferenced, including `scripts/down.sh`, `scripts/up.sh`, `scripts/package.sh`, `scripts/empty-versioned-bucket.py`, `ingest/scripts/package.py`, and `ingest/scripts/drain.py` only after `rg` confirms no caller

- [ ] Make each component script parse `dev|prod`, build only that project's package, initialize/apply its own Terraform root, and print its own outputs; use bash strict mode and the same region/account checks as Educagent.
- [ ] Make root deploy create/check the Terraform state bucket once, then call ingest, agents, backend and frontend exactly once in that order; preserve the final Cognito admin-create-user command.
- [ ] Make root destroy invoke frontend, backend, agents and ingest in reverse order; preserve state by default and remove it only when the existing explicit opt-in flag is passed.
- [ ] Remove redundant Ingest re-apply after frontend; configure allowed origin via environment values supplied to the ingest stack once the frontend domain is known, using the same simple staged CORS arrangement as Educagent.
- [ ] Keep explicit package/deploy scripts where Educagent has them; don't retain Python deployment glue or duplicate root helpers without an actual caller.

## Task 7: Update documentation and retire the old architecture description

**Files:**
- Modify `README.md`
- Modify `docs/architecture.md`, `docs/api.md`, `docs/deployment.md`, `docs/validation.md`
- Modify `ingest/README.md`
- Update `docs/superpowers/specs/2026-09-27-finantutor-design.md` to mark the older Managed KB decision superseded by the approved alignment spec
- Update `docs/diagrams/finantutor-aws.drawio` and regenerate its exported diagram artifacts only if those are maintained deliverables, so they no longer display Bedrock Managed Knowledge Base or Step Functions ingestion

- [ ] Describe Finantutor as the course tutor for AI master's students, identify its S3 Vectors-backed materials corpus, and document how a material moves from upload to searchable.
- [ ] Document prerequisites and exact `./scripts/deploy.sh dev|prod` and `./scripts/destroy.sh dev|prod` commands and their order, plus the Cognito user command emitted by deploy.
- [ ] Remove claims about Managed KB indexing, corpus synchronization, workflow polling and eliminated UI capabilities.
- [ ] Keep the older design document historically readable while clearly marking its conflicting KB/Step Functions decisions superseded and linking this alignment specification.
- [ ] Update the diagram only if its HTML/SVG/PNG exports are part of the normal project documentation workflow; don't regenerate unrelated visual artifacts.

## Task 8: Review and final integration

- [ ] Search the complete Finantutor tree for managed KB, ingestion job, Step Functions, ficha, outline/progress screen, removed script, and obsolete deployment variable references; classify remaining mentions as historical documentation or remove them.
- [ ] Review the Terraform graph and environment variable names against the app, agent and ingest compositions; ensure every emitted output has a consumer and each IAM action is resource-scoped.
- [ ] Run no tests or deployment commands unless separately requested; leave all AWS mutation to the user's explicitly run deploy script.
- [ ] Summarize changed areas and remaining verification commands for the user without claiming unrun checks passed.

## Self-review against the approved specification

- S3 upload, Lambda PDF extraction/chunking, Titan embeddings, S3 Vectors metadata/index: Tasks 1–2.
- Single AgentCore tutor, grounded retrieval and no ficha generation: Task 3.
- Authenticated chat, courses/materials and status lifecycle: Task 4.
- Exactly chat and materials in frontend: Task 5.
- Component scripts, root order, reverse destruction, Cognito command: Task 6.
- Documentation and old managed-KB references: Task 7.
- No remote deploy/destroy and explicit stale-reference review: Task 8.

## Execution decision

The user requested both the plan and implementation. Proceed inline, sequentially, in the primary Finantutor workspace after publishing this plan; preserve the existing staged/unstaged user changes and do not deploy to AWS.
