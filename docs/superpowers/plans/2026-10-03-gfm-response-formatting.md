# GFM Response Formatting Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not create commits for this task.

**Goal:** Render valid Markdown tables and lists and instruct the tutor to generate their required line structure.

**Architecture:** Add `remark-gfm` to the existing `react-markdown` pipeline. Add narrowly scoped formatting rules to the tutor system prompt rather than heuristically rewriting malformed tables in the browser.

**Tech Stack:** React, TypeScript, react-markdown, remark-gfm, Vitest, Python, pytest, Strands Agents

---

### Task 1: Specify frontend GFM behavior

**Files:**
- Modify: `frontend/src/features/chat/AgentMarkdown.test.tsx`

- [x] Add a component test that passes a valid multiline GFM table and bullet list.
- [x] Run the focused test and confirm it fails because no `<table>` is produced.

### Task 2: Enable GFM parsing

**Files:**
- Modify: `frontend/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `frontend/src/features/chat/AgentMarkdown.tsx`

- [x] Install `remark-gfm` as a frontend runtime dependency.
- [x] Register `remarkGfm` alongside `remarkMath`.
- [x] Run the focused frontend test and confirm it passes.

### Task 3: Specify and implement tutor formatting guidance

**Files:**
- Modify: `agents/test/unit/infrastructure/test_tutor_agent.py`
- Modify: `agents/src/infrastructure/adapters/llm/tutor_agent.py`

- [x] Extend the public `TutorAgent.reply` test to inspect the system prompt supplied to the mocked Strands agent.
- [x] Confirm the agent test fails before the prompt is changed.
- [x] Add explicit GFM table and list formatting rules to `_SYSTEM_PROMPT`.
- [x] Run the focused agent test and confirm it passes.

### Task 4: Validate the complete change

- [x] Run all frontend tests.
- [ ] Run all agent tests. The unrelated `test_tool_progress_is_a_status_event` hangs; the other 11 agent tests pass.
- [x] Build the production frontend.
- [x] Run `git diff --check` and review that no unrelated files changed.

### Task 5: Recover concatenated emoji lists

**Files:**
- Modify: `frontend/src/features/chat/AgentMarkdown.test.tsx`
- Modify: `frontend/src/features/chat/AgentMarkdown.tsx`

- [x] Add a regression test using the reported TIR advantages and limitations.
- [x] Run the focused test and confirm the concatenated paragraphs are not lists.
- [x] Normalize only lines that start with and contain multiple `✅` or `⚠️` markers.
- [x] Run the focused test, full frontend suite, and production build.
