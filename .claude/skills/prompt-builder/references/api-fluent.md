# API Reference — Fluent Builder

Every method on `PromptBuilder`, plus the generator functions from `@kasava/prompt-builder/presets`. Builder methods return `this` for chaining; preset functions return a `PromptBuilder` to pass to `.include()`. `build(dialect?)` returns the final string.

## Constructors

### `prompt(): PromptBuilder`

Creates a new builder instance.

### `section(title: string, level?: 1|2|3): PromptBuilder`

Creates a standalone named builder with a heading. Use with `.include()` for composable prompts.

> **Not to be confused with** the instance method `.section(title, content)` (see Formatting Primitives) — the exported `section()` function creates a new builder, while `.section(title, content)` adds a bold field to the current builder.

---

## Identity & Persona

### `.role(title: string, task?: string): this`

Sets agent persona. Generates: `You are a/an {title}{, task}.`

- Do NOT include "a"/"an" in `title` — auto-detected from first character
- Always call this first in the chain

```ts
import { prompt } from "@kasava/prompt-builder";

prompt().role("job-candidate match scorer", "with access to RAG tools").build();
// → "You are a job-candidate match scorer with access to RAG tools."
```

---

## Process & Workflow

### `.protocol(opts: { name: string, triggers?: string[], description?: string, steps: ProtocolStep[], outputFormat?: string, followThrough?: string }): this`

Multi-step process definition. The core method for defining how an agent should work through a task.

Each `ProtocolStep`: `{ label: string, description?: string, actions?: string[] }`

**Output:**

```markdown
## Protocol: {name}

Trigger phrases: '...', '...'
**{label}**
{description}
(1) {action}
(2) {action}

End with: "{followThrough}"
```

**Usage:**

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .protocol({
    name: "Job Match Scoring",
    triggers: ["score this job", "evaluate match"],
    steps: [
      {
        label: "Step 1 — Check hard rejections",
        description: "Check avoid list against required tech.",
        actions: [
          '"Hard pass" tech is primary → score 0, "Auto-rejected", stop.',
          '"Avoid as primary" appears only as one of several → proceed, note in Key Gaps.',
        ],
      },
      {
        label: "Step 2 — RAG lookup",
        actions: [
          "search_documents for matching REQUIRED tech",
          "expand_chunk_context for best matches",
        ],
      },
    ],
    followThrough: "Provide final score with breakdown.",
  })
  .build();
```

### `.investigationStrategy(phases: { name: string, description?: string, steps?: string[] }[], title?: string): this`

Numbered multi-phase investigation plan. Use when the agent must explore/discover in sequential phases.

**Output:**

```markdown
## Investigation Strategy

### Phase 1: Discover Entry Points

Search for relevant symbols in the codebase.

- Use codeTool(action="search_symbols")
- Filter by isExported=true
- Identify direct callers

### Phase 2: Analyze

- Build call graph from each entry point
```

- `name` is required, auto-numbered starting from 1 — don't include numbers in `name`
- `description` is plain text rendered as-is
- `steps` is a bulleted list, silently skipped if empty/null
- Title defaults to `"Investigation Strategy"`

### `followThroughMatrix(opts: { title: string, description?: string, rows: { action: string, followThrough: string }[], postRule: string })` — from `/presets`

Action → next-step lookup table. Tells the model what to offer after completing each action. Builds on `.lookupTable()` with columns `["Completed action", "Follow-through offer"]`; `postRule` lands as the table's `postNote`.

> The `.followThroughMatrix()` class method is a deprecated shim for `.include(followThroughMatrix(...))` — removed in 1.0.

**Output:**

```markdown
## {title}

{description}

| Completed action | Follow-through offer |
| ---------------- | -------------------- |
| {action}         | {followThrough}      |

{postRule}
```

**Usage:**

```ts
import { prompt } from "@kasava/prompt-builder";
import { followThroughMatrix } from "@kasava/prompt-builder/presets";

prompt()
  .include(
    followThroughMatrix({
      title: "After Analysis Actions",
      description:
        "After completing each analysis type, offer the relevant follow-up.",
      rows: [
        {
          action: "Scored a job listing",
          followThrough: "Offer to generate cover letter if score >= 50",
        },
        {
          action: "Generated cover letter",
          followThrough: "Offer to fact-check claims against portfolio",
        },
        {
          action: "Fact-check complete",
          followThrough: "Offer to humanize and finalize",
        },
      ],
      postRule:
        "Always wait for user confirmation before proceeding to the next step.",
    }),
  )
  .build();
```

---

## Decision Rules & Priorities

### `.arrowRules(opts: { title: string, introduction?: string, types: ArrowRule[], postRules?: string[] }): this`

Grouped decision rules with `→` prefix. Use for hard boundaries, priority rules, and conditional logic.

Each `ArrowRule`: `{ name: string, description?: string, rules: string[] }`

**Output:**

```markdown
## {title}

{introduction}

**{name}** — {description}
→ {rule}
→ {rule}

**{name2}** — {description2}
→ {rule}

1. {postRule}
2. {postRule}
```

Note: `postRules` render as a numbered list with no label prefix.

**Usage:**

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .arrowRules({
    title: "Scoring Priority (highest first)",
    types: [
      {
        name: "Hard rejections",
        description: "From Candidate Job Search Profile",
        rules: [
          "Always score 0, no exceptions.",
          "Do NOT run RAG queries for auto-rejected jobs.",
        ],
      },
      {
        name: "Everything else",
        description: "Score generously",
        rules: ["Consider transferable skills within the same paradigm."],
      },
    ],
    postRules: ["Never treat cross-paradigm experience as transferable."],
  })
  .build();
```

---

## Scoring & Classification

### `.lookupTable(opts: { title?: string, description?: string, columns: [string, string], rows: [string, string][], postNote?: string }): this`

Two-column reference table. The foundation for rubrics, score ranges, and reference data.

**The table skips when `rows` is empty**, matching `.table()` — no header-only table; a given `title` still renders its heading. (0.2.x emitted the heading plus a header-only table; `markdown({ strict: true })` reproduces those bytes.)

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .lookupTable({
    title: "Technical match (40 pts)",
    columns: ["Criteria", "Score range"],
    rows: [
      [
        "Primary skill alignment",
        "15=exact, 12=strong secondary, 8=transferable, 0=none",
      ],
      [
        "Framework/tools alignment",
        "15=perfect, 12=most match, 8=key match some gaps, 0=none",
      ],
    ],
  })
  .build();
```

### `.severityScale(title: string, levels: { level: string, description: string }[]): this`

Tiered classification scale. Use for final recommendations, severity ratings, or any named tier system.

**Note:** Uses heading level 3 (`###`), not level 2 like most other generators. This makes it a sub-section — typically placed under a `## Scoring Rubric` heading. Renders as a single tight list (0.2.x left blank lines between bullets).

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .severityScale("Recommendation", [
    { level: "Strong Match", description: "80-100" },
    { level: "Good Match", description: "70-79" },
    { level: "Decent Match", description: "60-69" },
    { level: "Stretch", description: "50-59" },
    { level: "Weak Match", description: "<50" },
  ])
  .build();
```

### `.confidenceScale(tiers?: { range: string, label: string }[]): this`

Confidence scale for evidence-based assessments. Internally delegates to `.lookupTable()` with columns `["Range", "Interpretation"]`. Title is always `"Confidence Scoring"`.

**Default tiers** (used when called with no arguments):

| Range     | Label                                    |
| --------- | ---------------------------------------- |
| 0.9–1.0   | Certain — direct evidence or exact match |
| 0.7–0.89  | Probable — strong contextual match       |
| 0.5–0.69  | Possible — related but indirect          |
| Below 0.5 | Do not include — too weak                |

**Custom tiers** — `range` is a free-form string, use whatever scale fits:

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .confidenceScale([
    { range: "90-100", label: "Strong evidence — multiple project matches" },
    { range: "70-89", label: "Moderate evidence — partial overlap" },
    { range: "50-69", label: "Weak evidence — tangential relevance" },
    { range: "Below 50", label: "Insufficient evidence — skip" },
  ])
  .build();
```

---

## Tool Usage

### `toolGuidance(tools: { tool: string, usage: string }[], title?: string)` — from `/presets`

Tool reference table. Generates a two-column lookup table with columns `["Tool", "Usage"]`. Use when the agent has access to external tools (RAG, search, APIs). Title defaults to `"Available Tools"`.

> The `.toolGuidance()` class method is a deprecated shim for `.include(toolGuidance(...))` — removed in 1.0.

```ts
import { prompt } from "@kasava/prompt-builder";
import { toolGuidance } from "@kasava/prompt-builder/presets";

prompt()
  .include(
    toolGuidance([
      {
        tool: "search_documents",
        usage:
          "Find candidate's projects matching REQUIRED tech. Use 2-3 focused queries.",
      },
      {
        tool: "expand_chunk_context",
        usage:
          "Get more context around a search result when you need deeper detail.",
      },
    ]),
  )
  .build();
```

---

## Quality & Safety Checks

### `.verificationChecklist(items: string[], title?: string): this`

Pre-return verification steps. Generates a heading with "Before returning your output, verify:" prefix, then a bulleted checklist. Use to ensure the model self-checks its work before responding.

**Implementation:**

```
heading(title, 2)         → ## Pre-Return Checklist
raw("Before returning your output, verify:")
list(items)               → - item
```

**Output:**

```markdown
## Pre-Return Checklist

Before returning your output, verify:

- All entry points have been discovered
- Call graph is complete (no orphaned nodes)
- Risk assessment accounts for indirect dependencies
```

**Usage:**

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .verificationChecklist([
    "All required technologies have been scored",
    "Hard rejections were checked before RAG queries",
    "Total score adds up to exactly 100",
    "Recommendation tier matches the score range",
  ])
  .build();
```

### `gracefulDegradation(rules: string[], title?: string)` — from `/presets`

Error handling / fallback rules. Generates a heading + bulleted list. Use when the agent uses tools that might fail or return no results. Title defaults to `"Graceful Degradation"`.

> The `.gracefulDegradation()` class method is a deprecated shim for `.include(gracefulDegradation(...))` — removed in 1.0.

**Output:**

```markdown
## Graceful Degradation

- If tool calls fail, note the failure but continue.
- Never fail the entire analysis because one step had issues.
- Provide partial results with confidence levels.
```

```ts
import { prompt } from "@kasava/prompt-builder";
import { gracefulDegradation } from "@kasava/prompt-builder/presets";

prompt()
  .include(
    gracefulDegradation([
      "If tool calls fail, note the failure but continue.",
      "Never fail the entire analysis because one step had issues.",
    ]),
  )
  .build();
```

### `.guidelines(items: string[], title?: string): this`

Behavioral rules as a titled bullet list. Use for soft rules that shape agent behavior.

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .guidelines([
    "Always read Candidate Job Search Profile BEFORE scoring.",
    "If RAG returns no results, score based on CV and profile alone.",
    "Score generously for transferable skills within the same paradigm.",
  ])
  .build();
```

---

## Analysis & Requirements

### `analysisRequirements(description: string, requirements: string[], jsonStructure?: object)` — from `/presets`

Numbered requirements list with description. Use to define what the model must analyze and how.

> The `.analysisRequirements()` class method is a deprecated shim for `.include(analysisRequirements(...))` — removed in 1.0.

**Output:**

```markdown
## Analysis Requirements

{description}

1. {requirement}
2. {requirement}
3. {requirement}
```

If `jsonStructure` is provided, appends: `Format your response as JSON with the following structure:` + a JSON code block. **Note:** `jsonStructure` parameter is optional and rarely needed — JSON output format is handled at the API level.

```ts
import { prompt } from "@kasava/prompt-builder";
import { analysisRequirements } from "@kasava/prompt-builder/presets";

prompt()
  .include(
    analysisRequirements(
      "Analyze the job listing against the candidate's profile and portfolio",
      [
        "Check hard rejections from Candidate Job Search Profile first",
        "Use RAG tools to find matching portfolio projects",
        "Score each dimension according to the rubric",
      ],
    ),
  )
  .build();
```

---

## Examples (Worked Examples)

### `workedExample(example: WorkedExample)` — from `/presets`

Single worked example in `<example>` XML tags. Teaches the model the expected behavior via demonstration. The XML wrapper is tight (0.2.x had blank lines between tag and content).

`WorkedExample` type: `{ mention: string, context: string, protocol: string, toolCalls: string[], response: string }`

**Output:**

```xml
<example>
<context>{context}</context>
<mention>{mention}</mention>
<protocol>{protocol}</protocol>
<tool_calls>
1. {toolCall}
2. {toolCall}
</tool_calls>
<ideal_response>
{response}
</ideal_response>
</example>
```

> The `.workedExample()` class method is a deprecated shim for `.include(workedExample(...))` — removed in 1.0.

```ts
import { prompt } from "@kasava/prompt-builder";
import { workedExample } from "@kasava/prompt-builder/presets";

prompt()
  .include(
    workedExample({
      context: 'GitHub issue #214, "Add auto-reproduction step"',
      mention: "@kasava is this still relevant?",
      protocol: "Issue Closure Assessment",
      toolCalls: [
        "commitTool({ action: 'related', repositoryId, query: '...' })",
        "githubIssueSearchTool({ query: '...', repositoryId })",
      ],
      response:
        "**NO** — still relevant, not implemented.\n\n- No commits found...",
    }),
  )
  .build();
```

### `workedExamples(examples: WorkedExample[], title?: string)` — from `/presets`

Multiple examples wrapped in `<examples>` tags with a heading. Title defaults to `"Worked Examples"`. Same shim note as `workedExample` — `.include(workedExamples(...))` is the canonical form.

---

## XML Content Tags

Wrap content in semantic XML boundaries. These create clear signal boundaries that help the model distinguish instructions from data.

### `.tag(name: string, content: string): this`

Wrap content in arbitrary XML tags.

### `.openTag(name: string) / .closeTag(name: string): this`

Manual XML tag pairs for multi-step content building.

### Shorthand tags:

| Method                      | Wraps in            | Use for                                |
| --------------------------- | ------------------- | -------------------------------------- |
| `.instructions(content)`    | `<instructions>`    | Final directives the model must follow |
| `.context(content)`         | `<context>`         | Background info, CV, profile data      |
| `.data(content)`            | `<data>`            | Input schema descriptions              |
| `.example(content)`         | `<example>`         | Single example                         |
| `.examples(content)`        | `<examples>`        | Multiple examples wrapper              |
| `.thinking(content)`        | `<thinking>`        | Chain-of-thought guidance              |
| `.answer(content)`          | `<answer>`          | Answer format                          |
| `.formatting(content)`      | `<formatting>`      | Formatting rules                       |
| `.findings(content)`        | `<findings>`        | Analysis findings                      |
| `.recommendations(content)` | `<recommendations>` | Recommendations                        |
| `.output(content)`          | `<output>`          | Output specification                   |

**Single-use (except examples).** Each shorthand emits one fixed-name tag. Call a given shorthand at most once per prompt — two `<context>` (or `<data>`, …) blocks can confuse the model about which is which. For several distinct sources, use `.tag(uniqueName, content)` with a descriptive name per block. The example family (`.example()`, `.examples()`, and the `/presets` `workedExample`/`workedExamples`) is exempt: multiple `<example>` tags are a valid few-shot pattern.

---

## Formatting Primitives

Simple building blocks. Prefer high-level generators above over these.

| Method                        | Description                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `.heading(text, level?)`      | Markdown heading. Default level 2 (`##`).                                           |
| `.section(title, content)`    | Bold field with value. Skipped if content is null/undefined.                        |
| `.raw(content)`               | Raw text, no formatting.                                                            |
| `.separator()`                | Horizontal rule (`---`), normalized spacing (0.2.x emitted excess blank lines).     |
| `.delimiter(style?)`          | Section delimiter. Default: `dash` (`---`). Options: `'dash'`, `'hash'`, `'quote'`. |
| `.field(label, value)`        | Bold label + value. Skipped if value is null/undefined.                             |
| `.booleanField(label, value)` | Yes/No field.                                                                       |

`.section(title, content)` and `.field(label, value)` both render `**Title:** value` — unified (0.2.x used two different formats).

---

## Lists

| Method                                   | Description                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `.list(titleOrItems, items?)`            | Bullet list. Title optional — pass array for bare list. Skipped if items is null/empty. |
| `.numberedList(titleOrItems, items?)`    | Numbered list variant. Same signature as `.list()`.                                     |
| `.inlineList(label, items, fallback?)`   | Comma-separated inline list with fallback for empty.                                    |
| `.limitedList(items, max, overflowMsg?)` | Bulleted list with max count and overflow indicator.                                    |
| `.keyValues(pairs)`                      | Key-value pairs as bulleted list.                                                       |
| `.table(columns, rows)`                  | Generic markdown table. Skipped if rows is empty.                                       |

Cell content is escaped in `.table()` and `.lookupTable()` — a `|` in a cell cannot break the row (0.2.x corrupted the table silently).

`.keyValues(pairs)` and `.limitedList(items, max, overflowMsg?)`: empty input pushes nothing (0.2.x left a stray blank line).

---

## Code & Diff

| Method                            | Description                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.codeBlock(content, language?)`  | Fenced code block.                                                                                                                                                              |
| `.diffBlock(content, maxLength?)` | Diff code block with optional truncation.                                                                                                                                       |
| `.filesList(title, files)`        | Files changed section with counts. `files`: `{ filename, status?, additions?, deletions? }[]`. Counts are pluralized correctly (`1 file` / `2 files`; 0.2.x printed `1 files`). |

---

## Composition

### `.include(other: PromptBuilder | Fragment | string): this`

Merge another builder's content — splices the child's AST nodes, so the prompt stays walkable. **Snapshot, not lazy** — changes to source after include are not reflected.

### `.conditional<T>(condition: T|null|undefined|false|0|'', builder: (b, value: NonNullable<T>) => PromptBuilder): this`

Conditionally add content. Builder only runs when condition is truthy. Type-safe access to narrowed value.

```typescript fragment
.conditional(config.skills, (b, skills) => b
  .list("Required Skills", skills)
)
```

---

## Output

### `.build(dialect?: Dialect): string`

Final prompt string. Parts joined with `\n\n` (paragraph breaks). Defaults to corrected markdown. `markdown({ strict: true })` reproduces pre-0.3 bytes exactly.

---

## Deprecated class methods

All still work in 0.3.x; all are removed in 1.0. Migrate call sites now:

- `.newline()` / `.paragraph()` / `.blankLine()` — no-ops, `build()` joins with `\n\n` automatically; delete the calls
- `.bullets(items)` — use `.list(items)` without title
- `.steps(items)` — use `.numberedList(items)` without title
- `.toolGuidance()` → import from `@kasava/prompt-builder/presets` and `.include()`
- `.gracefulDegradation()` → import from `@kasava/prompt-builder/presets` and `.include()`
- `.analysisRequirements()` → import from `@kasava/prompt-builder/presets` and `.include()`
- `.followThroughMatrix()` → import from `@kasava/prompt-builder/presets` and `.include()`
- `.workedExample()` / `.workedExamples()` → import from `@kasava/prompt-builder/presets` and `.include()`

---

## Static Utilities

### `PromptBuilder.truncate(text: string, maxLength: number): string`

Truncate with ellipsis.

### `PromptBuilder.formatLimitedList<T>(items, formatter, maxItems, overflowMessage?): string[]`

Format limited list without pushing to builder. Use with `.raw()`.

---

## Exported Types

```typescript fragment
interface ArrowRule {
  name: string; // Bold type label (e.g., "Misunderstanding")
  description?: string; // Optional description after the label
  rules: string[]; // Arrow-prefixed rules (the → lines)
}

interface ProtocolStep {
  label: string; // Step label (e.g., "Step 1 — Gather signals")
  description?: string; // Step description or instructions
  actions?: string[]; // Sub-items within the step
}

type TableRow = [string, string];

interface WorkedExample {
  mention: string; // The user's mention text
  context: string; // Brief context
  protocol: string; // Which protocol this maps to
  toolCalls: string[]; // Tool calls the agent should make, in order
  response: string; // The ideal response text
}
```

---

## Output Specification

### `.outputFormat(fields: { field: string, type: string, description: string }[], title?: string): this`

A simple structured-output field list. Generates a heading + "You must return structured output with:" + one bullet per field: `**field** (type): description`.

```ts
import { prompt } from "@kasava/prompt-builder";

prompt()
  .outputFormat([
    { field: "score", type: "number", description: "0-100" },
    { field: "summary", type: "string", description: "One-line rationale" },
  ])
  .build();
```

**Limitation — flat fields only.** Each entry is a single `{ field, type, description }` rendered as one bullet. `.outputFormat()` cannot express nested objects, arrays of objects, `$ref`, `anyOf`/`oneOf`, `enum`, `required` vs optional, `additionalProperties`, or nullable fields. If your output is a rich/validated JSON Schema (e.g. derived from Effect, Zod, or Pydantic), do not flatten it into `.outputFormat()` — inject the full schema document directly (e.g. via `.codeBlock(schemaJson, "json")` plus `.guidelines()` on how to fill it) and drive actual JSON output at the API layer (`response_format: { type: "json_object" }` or equivalent).
