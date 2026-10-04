# Agent Empty Reply Fallback Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not create commits for this task.

**Goal:** Increase tutor capacity to eight turns and guarantee that empty agent replies become a consistent persisted fallback instead of successful blank messages.

**Architecture:** Keep Strands budget configuration in the agent layer, enforce the non-empty reply invariant at the backend application boundary before yielding or persisting `done`, and retain frontend normalization as defense in depth. Existing empty DynamoDB records are repaired at read time by HTTP serialization.

**Tech Stack:** Python, pytest, TypeScript, Vitest, Express, React

---

### Task 1: Increase the tutor turn budget

**Files:**
- Modify: `agents/test/unit/infrastructure/test_llm_limits.py`
- Modify: `agents/src/infrastructure/llm/limits.py`
- Modify: `agents/terraform/README.md`

- [x] Add a failing assertion that `TUTOR_LIMITS` uses 8 turns while retaining the token budgets.
- [x] Change the tutor limit from 5 to 8 and update operational documentation.
- [x] Run the focused agent test.

### Task 2: Enforce non-empty replies in the backend

**Files:**
- Modify: `backend/test/create-app.test.ts`
- Modify: `backend/src/application/post-conversation-message.ts`
- Modify: `backend/src/infrastructure/http/create-app.ts`

- [x] Add a failing integration test that an empty `done` is streamed as the fallback and persisted with `status: "error"`.
- [x] Add a failing integration test that a historical empty agent message is serialized as the fallback.
- [x] Normalize empty `done` events before yielding and persist them as errors.
- [x] Normalize empty historical agent messages at the HTTP boundary.
- [x] Run the focused backend tests.

### Task 3: Add frontend defense in depth

**Files:**
- Create: `frontend/src/features/chat/useChatSession.test.ts`
- Modify: `frontend/src/features/chat/useChatSession.ts`

- [x] Add failing unit tests for empty live and stored agent replies.
- [x] Normalize both paths to `API_AGENT` while preserving non-empty content.
- [x] Run the focused frontend test.

### Task 4: Validate

- [x] Run all agent tests that do not contain the known unrelated hanging chat-stream case, plus the focused changed tests.
- [ ] Run all backend tests and the backend TypeScript build. TypeScript, bundle, and 29/30 tests pass; the unrelated logger fixture expects a different filename than its input.
- [x] Run all frontend tests and the production frontend build.
- [x] Run `git diff --check`, review the diff, and leave all changes uncommitted.
