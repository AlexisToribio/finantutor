# Finantutor Course Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, offline-capable 15-minute Finantutor presentation, speaker script, and two validated Archify diagrams for the Modelos financieros y evaluación de proyectos course.

**Architecture:** Derive facts from the repository, represent the complete AWS topology and RAG path as independent Archify JSON/HTML artifacts, then embed presentation-scale SVG adaptations in one self-contained slide deck. Keep detailed speaking content and demo recovery procedures in a separate Markdown guide.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, inline SVG, Archify 2.17, Playwright-based visual checks

---

**Execution constraint:** Do not create Git commits. Leave all deliverables as local working-tree changes.

### Task 1: Verify source evidence and presentation facts

**Files:**
- Read: `README.md`
- Read: `frontend/src/**`
- Read: `backend/src/**`
- Read: `agents/main.py`
- Read: `agents/src/infrastructure/**`
- Read: `ingest/src/**`
- Read: `backend/terraform/**`
- Read: `agents/terraform/**`
- Read: `ingest/terraform/**`
- Read: `frontend/terraform/**`

- [ ] **Step 1: Map runtime components**

Use `rg` to confirm CloudFront/S3, Cognito, Lambda BFF, DynamoDB, AgentCore Runtime, AgentCore Memory, Bedrock Guardrails, Claude Sonnet, Titan Embeddings, S3 document storage, ingestion Lambda, and S3 Vectors.

- [ ] **Step 2: Map request and ingestion paths**

Trace the chat route, signed upload route, S3 notification, chunking, embedding, vector query, citations, streaming, and persisted history. Record only facts visible in code or Terraform.

- [ ] **Step 3: Verify presentation constants**

Confirm the model IDs and the limits 4096 tokens per response, 5 turns, 6500 cumulative output tokens, 26000 total tokens, and 105 seconds.

### Task 2: Produce the Archify AWS architecture artifact

**Files:**
- Create: `docs/finantutor-presentacion-aws.architecture.json`
- Create: `docs/finantutor-presentacion-aws.html`
- Create: Archify delivery and visual-check sidecars beside the HTML

- [ ] **Step 1: Read the required Archify schemas and one example**

Read `schemas/architecture.schema.json`, `schemas/common.schema.json`, and one architecture example from the Archify skill package.

- [ ] **Step 2: Author the candidate immediately**

Create a Spanish `architecture` source with `meta.quality_profile: "showcase"`, one clear user-to-runtime path, short storage and ingestion branches, no more than 12 nodes, and semantic labels for HTTPS/JWT, runtime invocation, model inference, context, history, upload, and vectors.

- [ ] **Step 3: Check Archify updates once**

Run: `node scripts/check-update.mjs`

- [ ] **Step 4: Validate and repair only diagnosed subjects**

Run: `node bin/archify.mjs validate architecture <candidate> --quality showcase --json`

Expected: all 9 artifact checks pass with zero composition errors and zero warnings.

- [ ] **Step 5: Deliver and visually check**

Run `deliver` once on the final candidate, then `visual-check` on the delivered HTML. Record deterministic and browser evidence without changing the frozen candidate.

### Task 3: Produce the Archify RAG data-flow artifact

**Files:**
- Create: `docs/finantutor-rag.dataflow.json`
- Create: `docs/finantutor-rag.html`
- Create: Archify delivery and visual-check sidecars beside the HTML

- [ ] **Step 1: Read the required data-flow schema and one example**

Read `schemas/dataflow.schema.json`, reuse the already-read common schema, and read one data-flow example.

- [ ] **Step 2: Author the candidate immediately**

Create a Spanish `dataflow` source with `meta.quality_profile: "showcase"`. Show two explicit phases: PDF ingestion into S3 Vectors and question retrieval into a grounded tutor response. Preserve page/title metadata and Titan's role as vectorizer rather than answer generator.

- [ ] **Step 3: Validate and repair only diagnosed subjects**

Run: `node bin/archify.mjs validate dataflow <candidate> --quality showcase --json`

Expected: all 9 artifact checks pass with zero composition errors and zero warnings.

- [ ] **Step 4: Deliver and visually check**

Run `deliver` once on the final candidate, then `visual-check` on the delivered HTML.

### Task 4: Build the slide deck and speaker guide

**Files:**
- Create: `docs/finantutor-presentacion.html`
- Create: `docs/README-presentacion-finantutor.md`

- [ ] **Step 1: Build the 10-slide HTML document**

Implement the approved 16:9 dark-blue/cyan visual system. Add the exact four names and student IDs, pedagogical problem/solution slides, simplified architecture and RAG SVGs based on the validated artifacts, controls/security limits, design decisions, demo prompt suggestions, and final takeaway.

- [ ] **Step 2: Add presentation behavior**

Implement Arrow/Page Up/Page Down/Home/End navigation, touch/click controls, slide counter, progress bar, fullscreen toggle, URL hash restoration, print styles, reduced-motion handling, and accessible labels. Keep all styles and scripts local to the HTML.

- [ ] **Step 3: Write the timed script**

Create a Spanish guide with time per slide, cumulative time, suggested speaker, spoken script, transitions, demo checklist, free-form prompt suggestions, and recovery steps for login failure, latency, or no relevant passages.

### Task 5: Validate the complete delivery

**Files:**
- Validate: `docs/finantutor-presentacion.html`
- Validate: `docs/README-presentacion-finantutor.md`
- Validate: all Archify sources, HTML, and sidecars

- [ ] **Step 1: Run structural checks**

Verify exactly 10 slides, four exact member names/IDs, all agreed timing labels, no external `http(s)` asset dependencies, and no unfinished placeholder text.

- [ ] **Step 2: Run browser checks at three sizes**

Inspect 1440×900, 1600×1000, and 1920×1080. Require no document overflow, no clipped slide content, correct keyboard navigation, working fullscreen control, and legible diagrams.

- [ ] **Step 3: Perform perceptual review**

Capture representative slides—cover, educational value, architecture, RAG, controls, and demo—and inspect them as images for hierarchy, contrast, spacing, and projection readability.

- [ ] **Step 4: Run final repository checks**

Run `git diff --check` and `git status --short`. Confirm that no commit was created and report all modified/untracked deliverables.
