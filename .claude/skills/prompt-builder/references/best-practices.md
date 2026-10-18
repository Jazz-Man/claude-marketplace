# Best Practices

Prompt engineering rules mapped to builder methods. Incorporates safety review principles from ai-prompt-engineering-safety-review.

## Safety

### No harmful content

Use `.guidelines()` to set boundaries:

```typescript fragment
.guidelines([
  "Never generate content that could harm individuals or groups.",
  "If a request is ambiguous, ask for clarification rather than assuming.",
])
```

### Prompt injection defense

Wrap user-controlled content in XML tags via `.context()` or `.data()`:

```typescript fragment
.context(userContent)  // <context>...</context>
```

XML tags create clear boundaries that help the model distinguish instructions from data.
Tag boundaries help the model tell instructions from data; they are not a security boundary — and `p` interpolation is serialization, not escaping. Canonical warning: [api-schema.md](api-schema.md) § The `p` tag.

### Bias mitigation

Avoid assumptions in `.role()` and `.guidelines()`:

```typescript fragment
.role("candidate evaluator")  // NOT "evaluate candidates like a senior male engineer"
.guidelines(["Evaluate based on stated criteria only, not inferred characteristics."])
```

### Privacy

Use `.data()` for structured input descriptions, not raw sensitive data:

```typescript fragment
.data("Input fields: name (public), title (public), email (excluded from analysis)")
```

## Clarity

### Unambiguous task

Start with `.role()` that defines WHO and WHAT:

```typescript fragment
.role("job-candidate match scorer", "with access to the candidate's GitHub portfolio via RAG tools")
```

### Sufficient context

Use `.context()` for a single background block, `.data()` for input schema:

```typescript fragment
.context(background)
.data("Input is a JSON object with: title, company_name, long_description, ...")
```

For several distinct sources, give each a unique `.tag()` — see [Distinct XML tags](#distinct-xml-tags).

### Defined constraints

Use `.arrowRules()` for hard boundaries, `.guidelines()` for soft rules:

```typescript fragment
.arrowRules({
  title: "Scoring Priority",
  types: [
    { name: "Hard rejections", description: "From profile", rules: ["Always score 0, no exceptions."] },
  ],
})
```

### `.raw()` for prose, tag methods for data

`.data()`, `.context()`, `.instructions()` wrap content in XML tags. Don't use them for an ordinary paragraph — the XML wrapper is semantic noise. Use `.raw()` for unformatted text; reserve `.data()` for input schema/shape descriptions.

```typescript fragment
.raw("First, read the profile carefully.") // plain text, no wrapper
// NOT .data("First, read the profile carefully.") → wraps it in <data>…</data>
```

## Structure

### XML for boundaries

The library wraps content in semantic XML tags automatically:

- `<context>` — background info
- `<data>` — input descriptions
- `<instructions>` — final directives
- `<example>` — worked examples

These create clear signal boundaries for the model.

### Distinct XML tags

Each tag-emitting shorthand (`.context()`, `.data()`, `.instructions()`, …) produces one fixed-name tag. Use each at most once per prompt (the example family — `.example()`, `.examples()`, and the `/presets` `workedExample`/`workedExamples` — is exempt; multiple `<example>` tags are a valid few-shot pattern). When you have several distinct sources, give each a unique tag name so the model can tell them apart:

```typescript fragment
.tag("candidate_cv", cv)
.tag("job_profile", profile)
```

### One heading per section

The generators (`.protocol`, `.arrowRules`, `.lookupTable` when titled, `.severityScale`, `.guidelines`, `.verificationChecklist`, `.investigationStrategy`, `.confidenceScale`, plus the `/presets` functions `toolGuidance`, `gracefulDegradation`, `analysisRequirements`, `workedExamples` — composed via `.include()`) each emit their own `##` heading — `.severityScale()` emits `###` and is meant to nest under a `##`. Pass your section label via the method's `title`; don't add a separate `.heading()` in front, or you get two consecutive headings.

```typescript fragment
.guidelines(rules, "Hard Rejections") // → ## Hard Rejections
// NOT: .heading("Hard Rejections").guidelines(rules) → ## Hard Rejections + ## Important Guidelines
```

Rule of thumb: `.heading()` is fine **unless** the following method also emits a `##`. It's valid with `.raw()` (no heading), with a title-less `.lookupTable({...})` (no heading), or as a `##` parent over `.severityScale()` (which emits `###`). A higher-level `.heading(..., 1)` as a deliberate parent is fine but rare.

### Tables for data

Use `.lookupTable()` for scoring rubrics, reference tables, and decision matrices:

```typescript fragment
.lookupTable({
  title: "Inferred work arrangement",
  columns: ["Signal in JD", "Arrangement"],
  rows: [
    ["'remote-first'", "Remote"],
    ["'hybrid, 2 days in office'", "Hybrid"],
  ],
})
```

### Protocols for processes

Use `.protocol()` for multi-step workflows — it gives numbered steps with actions:

```typescript fragment
.protocol({
  name: "Job Match Scoring",
  steps: [
    { label: "Step 1 — Check hard rejections", actions: ["Check avoid list against required tech"] },
    { label: "Step 2 — RAG lookup", actions: ["search_documents for matching projects"] },
  ],
  followThrough: "Provide final score with breakdown.",
})
```

### Cache boundaries

Order the prompt stable-first: content that never changes between requests, then `.cacheBoundary()`, then volatile per-request content. Provider caches match exact prefixes — keep the stable half byte-identical between requests or the cache never hits.

```typescript fragment
.include(staticInstructions)
.cacheBoundary()
.include(prompt().tag("request", userInput))
```

Text rendering ignores boundaries — only `toMessages()` acts on them. Mechanics: [api-output.md](api-output.md) § Chat messages and cache boundaries.

## Token Efficiency

### Auto-skip on null

All methods silently skip when given null/undefined/empty values. Use this for optional sections:

```typescript fragment
.section("Optional field", maybeNull)  // skipped entirely if null
```

### Limited lists

Use `.limitedList()` for potentially large collections:

```typescript fragment
.limitedList(tags, 10, (remaining) => `... and ${remaining} more`)
```

### Truncation

Use `PromptBuilder.truncate()` for long content:

```typescript fragment
.raw(PromptBuilder.truncate(longText, 2000))
```

### High-level generators over basic methods

`.protocol()` is more token-efficient than manual `.heading()` + `.numberedList()` because it uses a consistent, compact format the model recognizes.

### Budgets and priorities

Set the tier with `.priority()` before the nodes it governs, then trim to size with `.$budget()`:

```typescript fragment
.priority("required").include(coreRules)
.priority("low").include(workedExamples(examples)) // from /presets — first to drop
.$budget({ maxTokens: 8000 })
```

`.$budget()` returns a trimmed copy — it never mutates the builder. The default counter, `approximateTokens`, is a ~4 chars/token rule of thumb; pass a real tokenizer when margins matter. Drop order and `BudgetExceededError`: [api-output.md](api-output.md) § Token budget.

## Consistency

### Role for persona

Always use `.role()` — never manually write "You are a...":

```typescript fragment
.role("technical research assistant", "with access to indexed GitHub repository analyses")
```

### SeverityScale for levels

Use `.severityScale()` for any tiered classification:

```typescript fragment
.severityScale("Recommendation", [
  { level: "Strong Match", description: "80-100" },
  { level: "Good Match", description: "70-79" },
])
```

### Guidelines for rules

Use `.guidelines()` for behavioral rules, not loose `.list()`:

```typescript fragment
.guidelines([
  "Always read profile BEFORE scoring.",
  "Score generously for transferable skills within the same paradigm.",
])
```

## Testability

### Pure, synchronous builders

Builders are pure functions: data in as parameters, no I/O inside; the caller reads files and passes content in. See the Wrong/Right pair in [anti-patterns.md](anti-patterns.md) ("Doing I/O Inside the Builder").

### Test file

Iterate quickly by calling the builder with test data — no I/O, no await:

```typescript fragment
console.log(buildPrompt(testInput).build());
```

### Never hardcode content in CLI

CLI files call the prompt builder — they don't construct prompt content directly.

### Render-time snapshots

Schema templates are pure — call `.render(fixtureVars)` with fixed fixtures and snapshot the output:

```typescript fragment
const out = template.render({ userName: "Ada", activeShows: ["Severance"] });
```

### Strict vs corrected output

The corrected format renders by default; reach for `markdown({ strict: true })` only when pinning legacy bytes — see [api-output.md](api-output.md) § Dialects.

## Effectiveness Checklist

Before finalizing a prompt, verify:

1. **Task clarity** — `.role()` defines who and what
2. **Context sufficiency** — `.context()` for background, `.data()` for input schema
3. **Process definition** — `.protocol()` for multi-step workflows
4. **Decision rules** — `.arrowRules()` for hard boundaries
5. **Scoring/classification** — `.lookupTable()` + `.severityScale()` for rubrics
6. **Tool usage** — `toolGuidance` (from `/presets`) for available tools
7. **Error handling** — `gracefulDegradation` (from `/presets`) for fallbacks
8. **Behavioral rules** — `.guidelines()` for soft rules
9. **Final instructions** — `.instructions()` to wrap the last directive
10. **Output** — `.outputFormat()` for simple field specs; for rich/validated JSON Schemas, inject the schema directly and drive JSON output at the API layer; corrected markdown is the default — `markdown({ strict: true })` only when pinning legacy bytes
11. **Runtime data** — `definePrompt` + `.render()`
12. **Caching** — `cacheBoundary()` between stable and volatile
13. **Size** — `.$budget()` with explicit priorities
