# Prompt Patterns

Which methods to use for which kind of prompt. Start here when building a new prompt. Functions marked `→ /presets` come from `@kasava/prompt-builder/presets` and compose via `.include()` — the same-named class methods are deprecated shims, removed in 1.0; see [api-output.md](api-output.md) § The /presets subpath.

## Pattern Selection Guide

### Scoring / Classification Prompt

Use when the model must evaluate something against criteria and produce a score or classification.

```typescript fragment
prompt()
  .role(...)
  .context(...)                          // input data
  .include(toolGuidance([...]))          // if RAG/tools needed — from /presets
  .protocol({ name, steps, followThrough })  // scoring process
  .arrowRules({ title, types })          // decision priority
  .heading("Scoring Rubric")
  .lookupTable(...)                      // each scoring dimension
  .severityScale("Recommendation", [...]) // final classification
  .include(analysisRequirements(desc, reqs)) // what to analyze — from /presets
  .guidelines([...])                     // behavioral rules
  .instructions("Follow the protocol and return the scoring result.")
  .build()
```

**Key methods:** `lookupTable`, `severityScale`, `arrowRules`, `protocol`

---

### Tool-Using Agent Prompt

Use when the model has access to external tools (RAG, search, APIs) and must decide when/how to use them.

```typescript fragment
prompt()
  .role(...)
  .context(...)
  .data(...)                             // input schema description
  .include(toolGuidance([...]))          // tool reference table — from /presets
  .protocol({ name, steps, followThrough })  // decision process
  .arrowRules({ title, types })          // error handling rules
  .include(gracefulDegradation([...]))   // fallback behavior — from /presets
  .verificationChecklist([...])          // pre-return checks
  .guidelines([...])
  .instructions("Follow the protocol and return results.")
  .build()
```

**Key methods:** `toolGuidance` → `/presets`, `protocol`, `gracefulDegradation` → `/presets`

---

### Multi-Step Analysis Prompt

Use when the model must perform a sequence of analysis steps in order.

```typescript fragment
prompt()
  .role(...)
  .context(...)
  .protocol({ name, steps, followThrough })
  .investigationStrategy([...])          // numbered phases
  .include(gracefulDegradation([...]))   // from /presets
  .guidelines([...])
  .instructions("Follow the protocol and return results.")
  .build()
```

**Key methods:** `protocol`, `investigationStrategy`, `gracefulDegradation` → `/presets`

---

### Simple Q&A / Research Prompt

Use when the model answers questions using available tools without complex scoring.

```typescript fragment
prompt()
  .role(...)
  .include(toolGuidance([...]))          // or .heading("Tools").list([...]) — from /presets
  .guidelines([...])
  .build()
```

**Key methods:** `role`, `guidelines`, `list`

---

### Code Review / Diff Analysis Prompt

Use when the model analyzes code changes or diffs.

```typescript fragment
prompt()
  .role(...)
  .context(...)
  .diffBlock(content, maxLength?)
  .filesList("Changed files", [...])
  .protocol({ name, steps })
  .arrowRules({ title, types })
  .verificationChecklist([...])
  .build()
```

**Key methods:** `diffBlock`, `filesList`, `protocol`

---

### Context-Heavy Prompt (documents, profiles, etc.)

Use when injecting large external content into the prompt. The caller reads the files; the builder receives their contents as parameters.

```typescript fragment
interface Input {
  document: string; // caller already read the file
  profile: string; // caller already read the file
}

function buildPrompt(input: Input): string {
  return (
    prompt()
      .role("reviewer")
      .tag("document", input.document) // unique tag per source
      .tag("profile", input.profile) // distinct name — never reuse a fixed-name tag
      .data("Input schema: ...") // single <data> block
      // ... rest of prompt
      .build()
  );
}
```

**Key methods:** `context`, `data`, `include` (for reusable fragments)

---

### Conditional / Dynamic Prompt

Use when prompt content varies based on runtime data.

```typescript fragment
prompt()
  .role(...)
  .conditional(data.features?.length, (b, features) => b
    .heading("Features")
    .list(features.map(f => f.name))
  )
  .conditional(data.config, (b, config) => b
    .section("Config", config.settings)
  )
  .build()
```

When the pieces are assembled outside one chain — built in different places, combined by data — use the standalone combinators through `.include()`:

```ts
import { prompt, all, when, each } from "@kasava/prompt-builder";

const features = ["search", "expand"];

const dynamic = prompt()
  .role("listing analyzer")
  .include(all(when(features.length > 0, prompt().list("Features", features))))
  .include(each(features, (f) => prompt().raw(`Feature available: ${f}`)));
```

**Key methods:** `conditional` (chain), `when`/`unless`/`all`/`any`/`each` (combinators) — [api-schema.md](api-schema.md) § Combinators

---

### Runtime-Data Prompt

Use when content depends on values known only at render time and you want the variable set typed and checked — a missing required variable is a render-time error, not a silently empty section.

```typescript fragment
import {
  bool,
  definePrompt,
  list,
  p,
  prompt,
  text,
  when,
} from "@kasava/prompt-builder";

const template = definePrompt("listing_review", {
  itemName: text().notNull(), // required at render time
  features: list().default([]), // optional, with fallback
  isMobile: bool().default(false),
}).body((v) =>
  prompt()
    .role("listing reviewer")
    .tag("item", p`Name: ${v.itemName}`)
    .include(when(v.isMobile, prompt().raw("Keep the reply short."))),
);

template.render({ itemName: "Vintage lamp" }); // features/isMobile fall back to defaults
```

**Key methods:** `definePrompt`, `text`/`list`/`bool`, `when` — [api-schema.md](api-schema.md)

---

### Repeated-Render Prompt

Use when the same prompt renders many times and only slot values change — compile the AST once with `prepare()`, then re-render from slots instead of rebuilding.

```typescript fragment
import { p, placeholder, prompt } from "@kasava/prompt-builder";

const builder = prompt()
  .role("release announcer")
  .include(p`Version ${placeholder("version")} is live.`);

const prepared = builder.prepare("announce_v1"); // AST compiled once
prepared.params; // ["version"]
prepared.render({ version: "2.1.0" }); // each render fills slots only
prepared.render({ version: "2.2.0" });
```

**Key methods:** `prepare`, `placeholder` — [api-schema.md](api-schema.md) § Prepared prompts

---

### Composable / Reusable Prompt

Use when building prompts from shared fragments.

```typescript fragment
const safetyRules = section("Safety")
  .list(["No harmful content", "Respect privacy"]);

const styleRules = section("Communication Style")
  .list(["Be direct", "No preamble"]);

prompt()
  .role(...)
  .include(safetyRules)
  .include(styleRules)
  .build()
```

**Key methods:** `section`, `include`

---

### Multi-Target Output

Use when one prompt must ship in more than one shape — a markdown string for one consumer, chat messages for another — or when a provider cache makes the stable/volatile split explicit.

```typescript fragment
import { toMessages, xml } from "@kasava/prompt-builder";

const builder = prompt()
  .role("support triage")
  .context("Triage policy — stable across requests.") // cache-stable half
  .cacheBoundary() // marker lands on the block BEFORE it
  .data("Ticket: per-request content"); // volatile half

builder.build(); // markdown string — one consumer
builder.build(xml()); // XML dialect — another consumer
toMessages(builder); // ChatMessage[] with cache_control — chat consumer
```

**Key methods:** `toMessages`, `cacheBoundary`, `xml` — [api-output.md](api-output.md)

---

### Budget-Constrained Prompt

Use when the prompt must fit a token ceiling — tier sections with `.priority()`, then trim by dropping whole low-value nodes instead of truncating text.

```typescript fragment
import { prompt } from "@kasava/prompt-builder";
import { workedExample } from "@kasava/prompt-builder/presets";

const full = prompt()
  .role("code reviewer")
  .priority("required")
  .guidelines(["Answer only from the diff."]) // never dropped
  .priority("normal")
  .protocol({ name, steps, followThrough })
  .priority("low")
  .include(workedExample(/* long demonstration */)); // first to go

const trimmed = full.$budget({ maxTokens: 4000 }); // NEW builder — full is untouched
```

**Key methods:** `priority`, `$budget`, `approximateTokens` — [api-output.md](api-output.md) § Token budget

---

## Method-to-Pattern Matrix

| Method                               | Scoring | Tool Agent | Analysis | Q&A | Code Review | Context-Heavy | Conditional | Runtime-Data | Repeated-Render | Composable | Multi-Target | Budget |
| ------------------------------------ | :-----: | :--------: | :------: | :-: | :---------: | :-----------: | :---------: | :----------: | :-------------: | :--------: | :----------: | :----: |
| `.role()`                            |    Y    |     Y      |    Y     |  Y  |      Y      |       Y       |      Y      |      Y       |        Y        |     Y      |      Y       |   Y    |
| `.context()`                         |    Y    |     Y      |    Y     |  -  |      Y      |       Y       |      -      |      -       |        -        |     -      |      Y       |   -    |
| `.data()`                            |    Y    |     Y      |    -     |  -  |      -      |       Y       |      -      |      -       |        -        |     -      |      Y       |   -    |
| `.protocol()`                        |    Y    |     Y      |    Y     |  -  |      Y      |       -       |      -      |      -       |        -        |     -      |      -       |   Y    |
| `.arrowRules()`                      |    Y    |     Y      |    -     |  -  |      Y      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.toolGuidance()` → /presets         |    Y    |     Y      |    Y     |  Y  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.lookupTable()`                     |    Y    |     -      |    -     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.severityScale()`                   |    Y    |     -      |    -     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.guidelines()`                      |    Y    |     Y      |    Y     |  Y  |      Y      |       Y       |      -      |      -       |        -        |     -      |      -       |   Y    |
| `.analysisRequirements()` → /presets |    Y    |     -      |    Y     |  -  |      Y      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.gracefulDegradation()` → /presets  |    -    |     Y      |    Y     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.verificationChecklist()`           |    -    |     Y      |    Y     |  -  |      Y      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.investigationStrategy()`           |    -    |     -      |    Y     |  -  |      Y      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.confidenceScale()`                 |    -    |     -      |    Y     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   -    |
| `.workedExample()` → /presets        |    -    |     Y      |    -     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   Y    |
| `.conditional()`                     |    Y    |     Y      |    Y     |  -  |      Y      |       Y       |      Y      |      -       |        -        |     -      |      -       |   -    |
| `.include()`                         |    -    |     -      |    -     |  -  |      -      |       Y       |      Y      |      Y       |        Y        |     Y      |      -       |   Y    |
| `definePrompt()` + `.render()`       |    -    |     -      |    -     |  -  |      -      |       -       |      -      |      Y       |        -        |     -      |      -       |   -    |
| `p` / `placeholder()`                |    -    |     -      |    -     |  -  |      -      |       -       |      -      |      Y       |        Y        |     -      |      -       |   -    |
| `when`/`unless`/`all`/`any`/`each`   |    -    |     -      |    -     |  -  |      -      |       -       |      Y      |      Y       |        -        |     Y      |      -       |   -    |
| `toMessages()` + `.cacheBoundary()`  |    -    |     -      |    -     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      Y       |   -    |
| `.priority()` + `.$budget()`         |    -    |     -      |    -     |  -  |      -      |       -       |      -      |      -       |        -        |     -      |      -       |   Y    |
