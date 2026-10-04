# New Conversation Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not create commits for this task.

**Goal:** Let a signed-in student replace the active chat session with a fresh persisted UUID while preserving prior backend history.

**Architecture:** Keep session ownership in `useSessionId`, expose a callback that persists and activates a new UUID, and use the existing keyed `ChatPanel` remount to reset chat state. Place the action in the chat panel header and disable it while hydration or message generation is active.

**Tech Stack:** React 19, TypeScript, localStorage, Vitest, react-dom server rendering, Vite

---

### Task 1: Specify session replacement

**Files:**
- Create: `frontend/src/shared/session/useSessionId.test.ts`
- Modify: `frontend/src/shared/session/useSessionId.ts`

- [x] Add a failing test proving a replacement UUID is persisted under the current user's key without touching another user's session.
- [x] Run the focused test and confirm the replacement API is missing.
- [x] Add the minimal storage function and expose `startNewConversation` from `useSessionId`.
- [x] Run the focused test and confirm it passes.

### Task 2: Add the chat action

**Files:**
- Create: `frontend/src/features/chat/ChatPanel.test.tsx`
- Modify: `frontend/src/features/chat/ChatPanel.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/styles/layout.css`

- [x] Add a failing server-render test for the **Nueva conversación** action and its disabled hydration state.
- [x] Add `onNewConversation` to `ChatPanel`, render the button in `panel-head`, and disable it during hydration or pending work.
- [x] Update `App` to consume the session hook result and pass the callback.
- [x] Run the focused component test and confirm it passes.

### Task 3: Validate

- [x] Run all frontend tests.
- [x] Build the production frontend.
- [x] Run `git diff --check` and review the final diff.
- [x] Leave all changes uncommitted.
