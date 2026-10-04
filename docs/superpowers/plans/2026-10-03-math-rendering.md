# Math Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render inline and block LaTeX formulas in tutor responses without enabling raw HTML.

**Architecture:** Keep `AgentMarkdown` as the single rendering boundary and extend its unified pipeline with `remark-math` and `rehype-katex`. Load KaTeX CSS with the lazy component so the additional renderer remains part of the existing deferred Markdown path.

**Tech Stack:** React 19, TypeScript, react-markdown, remark-math, rehype-katex, KaTeX, Vitest, Vite

---

## File structure

- Create `frontend/src/features/chat/AgentMarkdown.test.tsx`: verifies formula rendering through the component's public props and server-rendered output.
- Modify `frontend/src/features/chat/AgentMarkdown.tsx`: configures math parsing, KaTeX rendering, and its stylesheet.
- Modify `frontend/package.json` and `pnpm-lock.yaml`: records runtime dependencies reproducibly with the repository's declared pnpm package manager.
- Modify `frontend/vite.config.ts`: keeps KaTeX-related modules in the lazy Markdown chunk.

### Task 1: Capture formula rendering behavior

**Files:**
- Create: `frontend/src/features/chat/AgentMarkdown.test.tsx`

- [x] **Step 1: Write the failing component test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentMarkdown } from "./AgentMarkdown";

describe("AgentMarkdown", () => {
  it("renders inline and block LaTeX formulas with KaTeX", () => {
    const html = renderToStaticMarkup(
      <AgentMarkdown
        text={"Criterio: $VAN > 0$.\n\n$$VAN = -I_0 + \\sum_{t=1}^{n} \\frac{FC_t}{(1+r)^t}$$"}
      />,
    );

    expect(html).toContain("katex");
    expect(html).toContain("katex-display");
    expect(html).toContain("VAN &gt; 0");
    expect(html).toContain("\\sum_{t=1}^{n}");
    expect(html).not.toContain("$$");
  });
});
```

- [x] **Step 2: Run the focused test and verify red**

Run: `pnpm --filter frontend test -- src/features/chat/AgentMarkdown.test.tsx`

Expected: FAIL because the output contains literal delimiters and has no KaTeX markup.

### Task 2: Add and configure math rendering

**Files:**
- Modify: `frontend/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `frontend/src/features/chat/AgentMarkdown.tsx`
- Modify: `frontend/vite.config.ts`

- [x] **Step 1: Install runtime dependencies**

Run: `pnpm --filter frontend add katex rehype-katex remark-math`

Expected: package manifests and lockfiles include the three packages.

- [x] **Step 2: Configure the Markdown pipeline**

Update `AgentMarkdown.tsx` to import `katex/dist/katex.min.css`, `rehype-katex`, and `remark-math`, then pass:

```tsx
remarkPlugins={[remarkMath]}
rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
```

Keep the existing safe link renderer and image suppression unchanged.

- [x] **Step 3: Assign math dependencies to the Markdown chunk**

Extend the Markdown condition in `vite.config.ts` with module identifiers for `katex`, `rehype-katex`, `remark-math`, and their math syntax utilities so the lazy-loaded feature remains grouped consistently.

- [x] **Step 4: Run the focused test and verify green**

Run: `pnpm --filter frontend test -- src/features/chat/AgentMarkdown.test.tsx`

Expected: PASS with inline and display KaTeX output.

### Task 3: Validate the frontend

**Files:**
- Modify: `docs/superpowers/plans/2026-10-03-math-rendering.md`

- [x] **Step 1: Run all frontend tests**

Run: `pnpm --filter frontend test`

Expected: all tests pass.

- [x] **Step 2: Build the production frontend**

Run: `pnpm --filter frontend build`

Expected: TypeScript and Vite finish successfully and emit the production bundle.

- [x] **Step 3: Review the final diff and mark this checklist complete**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the plan and math-rendering implementation files are modified or created, aside from pre-existing untracked user files.

- [x] **Step 4: Commit the implementation**

```bash
git add frontend/package.json pnpm-lock.yaml frontend/src/features/chat/AgentMarkdown.tsx frontend/src/features/chat/AgentMarkdown.test.tsx frontend/vite.config.ts docs/superpowers/plans/2026-10-03-math-rendering.md
git commit -m "feat: render math in tutor responses"
```
