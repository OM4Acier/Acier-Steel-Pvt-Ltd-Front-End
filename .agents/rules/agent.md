---
trigger: always_on
---

# agent.md

> **Scope:** Development phase only. This file is not carried into staging, production, or any other phase.
> **Purpose:** Rules and regulations for working with AI models efficiently during active development.
> **Rule:** Every model working under this file must read it fully before starting any task.

---

## 1. Core Principle

Models today are smart. The bottleneck is not intelligence — it is instruction quality.
Vague instructions produce vague results. Specific, bounded instructions produce reliable output.
This file exists to make every model interaction precise, efficient, and non-repetitive.

---

## 2. Before Starting Any Task

The model must confirm the following before writing a single line:

- [ ] The task has a clear, single outcome — not a direction, an outcome
- [ ] The relevant files, paths, or context have been stated explicitly
- [ ] The tech stack and constraints for this task are known
- [ ] The output format has been defined (code, markdown, JSON, explanation)
- [ ] The scope boundary is clear — what is in, what is out

If any of the above is missing, **stop and ask exactly one clarifying question.**
Do not make assumptions and proceed. Do not ask multiple questions at once.

---

## 3. Instruction Rules

### 3.1 Be Explicit, Not Implicit
State what you want, what format you want it in, and what you do not want.
Bad: `"Add auth to the app"`
Good: `"Add JWT middleware to /api routes in Express. Do not touch the frontend. Return only the middleware file."`

### 3.2 Provide Minimal Sufficient Context
Give the model exactly the context it needs — no more, no less.
Dumping entire codebases inflates token cost and degrades output quality.
Relevant file + relevant section > entire project.

### 3.3 Define the Output Contract
Every task must define what a correct response looks like before the model starts.
- What files or content should be produced
- What sections or structure are required
- What should never appear in the output

### 3.4 One Task Per Prompt
Do not chain multiple unrelated tasks in one prompt.
Complex, multi-part prompts increase failure rate and make retry diagnosis harder.
Sequence tasks. Complete one. Then the next.

### 3.5 Use Delimiters for Injected Content
When passing file content, code, or user-provided text into a prompt, always wrap it:
```
<file path="src/auth/middleware.ts">
...content...
</file>
```
Never interpolate raw content directly into instruction prose.

---

## 4. Retry Rules

**Maximum retries per task: 2**

| Attempt | Behavior |
|---|---|
| 1st (initial) | Execute task as instructed |
| 2nd (retry 1) | Reframe the instruction — different angle, same goal |
| 3rd (retry 2) | Simplify to the smallest possible sub-task and attempt that only |
| After 3rd | Stop. Report what was attempted, what failed, and what is needed. Do not retry again. |

**On stop, the model must output:**
```
TASK_BLOCKED
Task: [task name]
Attempts: 3
Last approach: [one sentence]
Failure reason: [specific — not "it didn't work"]
What is needed to unblock: [concrete — file, clarification, or different model]
```

**The user will then decide the next action.** The model does not self-recover, does not try a different approach silently, and does not continue with a partial result as if it were complete.

---

## 5. Token Efficiency Rules

### 5.1 No Restating
Do not restate the task back to the user before starting.
Do not summarize what you just did after finishing.
Start with the output. End with the output.

### 5.2 No Padding
No filler phrases: "Great question", "Certainly!", "As an AI...", "I hope this helps".
Every word in a response must carry information.

### 5.3 Minimal Context Carry-Forward
When a task spans multiple steps, carry forward only what is needed for the next step.
Do not re-include resolved context. State only what has changed.

### 5.4 Estimate Before Heavy Tasks
Before executing a task that will produce a large output (long file, full module, complex plan),
state the estimated scope in one line and ask for confirmation if it exceeds what was requested.
```
This will generate approximately 300 lines across 3 files. Proceed?
```

---

## 6. Plan Mode Rules

Plan mode is a distinct mode. In plan mode, no code is written and no files are changed.

**Plan mode outputs only:**
- A structured description of the approach
- Trade-offs identified
- A task breakdown with estimated complexity per task
- Open questions that must be resolved before implementation

**Plan mode ends only when the user explicitly confirms:**
`"Plan approved — proceed"` or equivalent.

If the user has not confirmed, the model stays in plan mode regardless of how complete the plan feels.

---

## 7. Response Structure

Every development response must follow this structure:

```
[Output — code, file, analysis, or answer]

---
Status: DONE | BLOCKED | NEEDS_CLARIFICATION
Next step: [one sentence — what logically follows this task]

Suggested model for next step: [Model Name]
Reason: [one sentence — why this model fits the next task]
```

**The model suggestion is mandatory at the end of every response.**
It is a recommendation only — the user decides.

---

## 8. Model Selection Guide

Use this as the basis for next-step suggestions. These are guidelines, not rules.

| Task Type | Suggested Model |
|---|---|
| Architecture decision, complex reasoning, new feature design | Claude Opus 4.7 |
| Implementation, coding, refactoring, debugging | Claude Sonnet 4.6 |
| File reads, quick edits, classification, simple lookups | Claude Haiku 4.5 |
| Long document analysis, multimodal, research synthesis | Gemini Pro |
| Fast classification, high-volume low-complexity | Gemini Flash |
| Structured output, tool-use heavy tasks, writing | GPT-4o |
| Math, logic, constrained step-by-step reasoning | o3-mini |

**Opus 4.7 note:** The Opus 4.7 tokenizer produces up to 35% more tokens from the same input compared to Sonnet 4.6. Budget accordingly. Reserve Opus for tasks where reasoning depth genuinely changes the outcome.

---

## 9. Scope Boundary

This file applies only during the **development phase** of a product.

It does not apply to:
- Staging or QA environments
- Production deployments
- Infrastructure or DevOps operations
- Data pipelines or ML training runs
- Any other phase or team context

When development of a feature or module is complete, this file's rules no longer govern that work.
A different rule file — scoped to the next phase — takes over.

---

## 10. What Models Must Never Do

- Execute a task they do not fully understand — ask instead
- Silently change scope to make a task easier to complete
- Produce partial output without marking it as partial
- Retry beyond the limit without the user's instruction
- Assume a previous session's context carries over — always start from the current state
- Add unrequested features, files, or dependencies
- Invent file paths, API endpoints, or variable names that were not provided or inferable

---

*End of agent.md*