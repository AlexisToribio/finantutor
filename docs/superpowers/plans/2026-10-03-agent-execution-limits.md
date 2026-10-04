# Finantutor Agent Execution Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the approved output-token, turn, total-token, timeout, and Bedrock transport budgets on Finantutor's single tutor agent.

**Architecture:** Add one infrastructure wrapper that owns Strands execution limits and wall-clock cancellation, inject its policy into `TutorAgent`, and configure the Bedrock model's per-response and transport bounds at composition time. Preserve the public chat contract and cover each boundary with focused unit tests.

**Tech Stack:** Python 3.10+, Strands Agents 1.56+, Amazon Bedrock, Botocore, pytest, uv

---

## File map

- Create `agents/src/infrastructure/llm/limits.py`: limit constants, timeout exception, and bounded agent invocation.
- Create `agents/test/unit/infrastructure/test_llm_limits.py`: wrapper behavior tests.
- Create `agents/test/unit/infrastructure/test_llm_load.py`: model transport configuration test.
- Create `agents/test/unit/infrastructure/test_tutor_agent.py`: tutor integration test.
- Modify `agents/src/infrastructure/config/settings.py`: per-response token constant.
- Modify `agents/src/infrastructure/llm/load.py`: max tokens and Botocore transport configuration.
- Modify `agents/src/infrastructure/adapters/llm/tutor_agent.py`: injected policy and wrapper call.
- Modify `agents/src/infrastructure/composition.py`: explicit policy wiring.
- Modify `agents/main.py`: pass the model output limit.
- Modify `agents/pyproject.toml`, `agents/requirements.txt`, and `agents/uv.lock`: compatible Strands version.
- Modify `agents/terraform/README.md`: document runtime budgets.

### Task 1: Add and test the execution wrapper

**Files:**
- Create: `agents/test/unit/infrastructure/test_llm_limits.py`
- Create: `agents/src/infrastructure/llm/limits.py`

- [ ] **Step 1: Write failing wrapper tests**

Create tests with a small result dataclass and `MagicMock` agents. Assert that `invoke_agent(..., limits={"turns": 2}, timeout_seconds=10)` passes both `limits` and a `threading.Event` as `cancel_signal`; that `stop_reason="cancelled"` raises `AgentTimeoutError`; and that a failing invocation does not leave the next invocation's cancel signal set.

- [ ] **Step 2: Run the focused tests and verify the missing-module failure**

Run: `cd agents && uv run pytest test/unit/infrastructure/test_llm_limits.py -v`

Expected: FAIL because `infrastructure.llm.limits` does not exist.

- [ ] **Step 3: Implement the wrapper and constants**

Define:

```python
TUTOR_LIMITS: Limits = {
    "turns": 5,
    "output_tokens": 6500,
    "total_tokens": 26000,
}
TUTOR_TIMEOUT_SECONDS = 105
```

Implement `AgentTimeoutError` and `invoke_agent` using monotonic deadlines, context variables for a shared request deadline and cancellation event, daemon `threading.Timer` instances, `agent.cancel()`, guaranteed cleanup in `finally`, timeout translation for cancelled results, and structured logging for budget and normal stop reasons. Match the approved design and Educagent's established implementation.

- [ ] **Step 4: Run the focused tests**

Run: `cd agents && uv run pytest test/unit/infrastructure/test_llm_limits.py -v`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the wrapper**

```bash
git add agents/src/infrastructure/llm/limits.py agents/test/unit/infrastructure/test_llm_limits.py
git commit -m "feat: add tutor execution budgets"
```

### Task 2: Bound model output and Bedrock transport

**Files:**
- Create: `agents/test/unit/infrastructure/test_llm_load.py`
- Modify: `agents/src/infrastructure/config/settings.py`
- Modify: `agents/src/infrastructure/llm/load.py`
- Modify: `agents/main.py`

- [ ] **Step 1: Write the failing model-loading test**

Patch `infrastructure.llm.load.BedrockModel`, call `load_model(model_id="test-model", max_tokens=512)`, and assert that its keyword arguments contain `max_tokens=512` and a `boto_client_config` whose connection timeout is 5, read timeout is 45, and retry dictionary is `{"total_max_attempts": 3, "mode": "adaptive"}`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd agents && uv run pytest test/unit/infrastructure/test_llm_load.py -v`

Expected: FAIL because `load_model` does not accept `max_tokens`.

- [ ] **Step 3: Implement model bounds**

Add `TUTOR_MAX_OUTPUT_TOKENS = 4096` to settings. Extend `load_model` with `max_tokens: int = 4096`, construct this Botocore configuration, and pass both values with or without a guardrail:

```python
Config(
    connect_timeout=5,
    read_timeout=45,
    retries={"total_max_attempts": 3, "mode": "adaptive"},
)
```

Import the constant in `main.py` and call `load_model(..., max_tokens=TUTOR_MAX_OUTPUT_TOKENS, ...)`.

- [ ] **Step 4: Run the focused test**

Run: `cd agents && uv run pytest test/unit/infrastructure/test_llm_load.py -v`

Expected: PASS.

- [ ] **Step 5: Commit the model configuration**

```bash
git add agents/main.py agents/src/infrastructure/config/settings.py agents/src/infrastructure/llm/load.py agents/test/unit/infrastructure/test_llm_load.py
git commit -m "feat: bound Bedrock model requests"
```

### Task 3: Apply budgets to TutorAgent

**Files:**
- Create: `agents/test/unit/infrastructure/test_tutor_agent.py`
- Modify: `agents/src/infrastructure/adapters/llm/tutor_agent.py`
- Modify: `agents/src/infrastructure/composition.py`

- [ ] **Step 1: Write a failing tutor integration test**

Patch `Agent` and `invoke_agent`, construct `TutorAgent` with sentinel limits and timeout, call `reply`, and assert that `invoke_agent` receives the created agent, input message, `role="tutor"`, the injected limits, and timeout. Return an object whose string form is `respuesta` and assert the public result remains `{"reply": "respuesta", "session_id": "session-1"}`.

- [ ] **Step 2: Run the test and verify failure**

Run: `cd agents && uv run pytest test/unit/infrastructure/test_tutor_agent.py -v`

Expected: FAIL because `TutorAgent` does not accept limits or use `invoke_agent`.

- [ ] **Step 3: Integrate the wrapper**

Add `Limits` plus the limit module imports. Extend `TutorAgent.__init__` with keyword defaults `limits: Limits = TUTOR_LIMITS` and `timeout_seconds: int = TUTOR_TIMEOUT_SECONDS`, store both, set `retry_strategy=None` when creating the Strands agent, and replace `agent(message)` with:

```python
result = invoke_agent(
    agent,
    message,
    role="tutor",
    limits=self._limits,
    timeout_seconds=self._timeout_seconds,
)
```

Update `build_tutor` to inject `TUTOR_LIMITS` and `TUTOR_TIMEOUT_SECONDS` explicitly.

- [ ] **Step 4: Run tutor and wrapper tests**

Run: `cd agents && uv run pytest test/unit/infrastructure/test_tutor_agent.py test/unit/infrastructure/test_llm_limits.py -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit tutor integration**

```bash
git add agents/src/infrastructure/adapters/llm/tutor_agent.py agents/src/infrastructure/composition.py agents/test/unit/infrastructure/test_tutor_agent.py
git commit -m "feat: enforce tutor execution limits"
```

### Task 4: Align dependencies and operations documentation

**Files:**
- Modify: `agents/pyproject.toml`
- Modify: `agents/requirements.txt`
- Modify: `agents/uv.lock`
- Modify: `agents/terraform/README.md`

- [ ] **Step 1: Pin the compatible Strands range**

Change both dependency manifests to `strands-agents >= 1.56.0, < 2.0.0` and run:

`cd agents && uv lock`

Expected: `uv.lock` records the same range without unrelated dependency changes.

- [ ] **Step 2: Document the budgets**

Add a `Presupuesto y límites de ejecución` section documenting 4096 tokens per response, 5 turns, 6500 output tokens, 26000 total tokens, 105 seconds per request, Bedrock 5/45-second transport timeouts, three adaptive attempts, and the preventive nature of cumulative token limits.

- [ ] **Step 3: Run all agent tests**

Run: `cd agents && uv run pytest`

Expected: all tests PASS.

- [ ] **Step 4: Check formatting and the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the intended dependency, runtime, test, and documentation files are modified.

- [ ] **Step 5: Commit dependency and documentation changes**

```bash
git add agents/pyproject.toml agents/requirements.txt agents/uv.lock agents/terraform/README.md
git commit -m "docs: describe tutor execution limits"
```
