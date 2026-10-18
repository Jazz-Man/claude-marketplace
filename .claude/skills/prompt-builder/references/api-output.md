# API Reference — Output Layer

What a built prompt becomes: dialects, chat messages with cache boundaries, AST inspection, token budgets, and the `presets`/`zod` subpaths. The builder methods live in [api-fluent.md](api-fluent.md); schemas, `p`, and prepared prompts in [api-schema.md](api-schema.md) — this page does not restate them.

## Dialects

`.build(dialect?)` renders the AST with a `Dialect`; the default is corrected markdown. One AST, many output formats.

- `markdown({ strict: true })` reproduces pre-0.3 output byte for byte. Each intentional formatting change records its old rendering on the node (the `legacy` field — grep for `legacy:` to audit what changed), and strict mode emits that verbatim. Use it to pin exact legacy bytes — a prompt cache you are not ready to invalidate, or proving a refactor changed nothing unintentionally. Off otherwise: the corrected form is the default.
- `xml()` renders field labels as XML elements instead of bold text — more reliable to parse when a prompt carries a lot of key/value context. Lists, tables, and code stay markdown; they are already unambiguous.
- `xml({ sectionTags: true })` also converts headings to tags derived from the heading text. Off by default — a structural rewrite that only makes sense for prompts written with it in mind.
- Custom dialects implement `Dialect`: `{ name, renderNode(node): string | null, join(blocks) }`. Returning `null` from `renderNode` omits the node entirely — that is how empty lists and empty tables disappear instead of leaving blank lines.

```ts
import { prompt, markdown, xml } from "@kasava/prompt-builder";

const b = prompt().field("Owner", "Ada").list(["alpha", "beta"]);

console.log(b.build()); // markdown (corrected)
console.log(b.build(markdown({ strict: true }))); // pre-0.3 bytes
console.log(b.build(xml())); // <owner>Ada</owner> + markdown list
```

---

## Chat messages and cache boundaries

`.cacheBoundary()` marks where cache-stable content ends and per-request content begins. Text dialects ignore it — only `toMessages` acts on it.

`toMessages(source, options?)` splits a prompt into `ChatMessage[]` (`{ role, content, cache_control? }`) at each boundary. `source` is anything with `.toAST()` (a builder) or a bare `Node[]`. Options (`MessagesOptions`): `role` (default `'system'`), `dialect` (default markdown), `cacheControl` (default on — a boundary with no marker has no purpose). The `cache_control: { type: 'ephemeral' }` marker lands on the block BEFORE each boundary.

Provider caches match an exact prefix, so the stable half must be byte-identical between requests to hit: keep it free of interpolation, and put volatile content after the boundary.

```ts
import { prompt, toMessages } from "@kasava/prompt-builder";

const messages = toMessages(
  prompt()
    .include(prompt().guidelines(["Be direct."]))
    .cacheBoundary()
    .include(prompt().tag("request", "Score this listing")),
);

console.log(messages[0].cache_control); // { type: 'ephemeral' }
console.log(messages[1].cache_control); // undefined
```

---

## Inspection

The AST is a flat list of blocks — composition splices child nodes in rather than collapsing them to strings, so everything below works on any builder.

- `.toAST()` → `Node[]` — a shallow copy; mutating the result does not affect the builder.
- `.toPrompt(dialect?)` → `{ text, params, dialect }` — inspect the compiled prompt without committing to a string (the `.toSQL()` analogue).
- `.params()` → placeholder names the prompt still expects, in first-seen order.
- `.node(node)` → push an arbitrary AST node — the escape hatch custom generators are built on.

Node kinds: `text`, `heading`, `field`, `list`, `table`, `code`, `tag`, `tagOpen`, `tagClose`, `rule`, `step`, `arrows`, `example`, `examples`, `template` (carrying placeholder slots), `cacheBoundary`, `empty`.

`walk(nodes, visit)` visits every node in order. Use it rather than iterating the array directly, so nested node kinds cannot silently escape traversal.

---

## Token budget

`.priority(level)` sets the budget tier carried by subsequently pushed nodes — `'required' | 'high' | 'normal' | 'low'`. It is sticky, so a whole section can be tiered in one place; the default is `normal`, and nothing but `$budget()` consults it.

`.$budget({ maxTokens, counter?, dialect? })` **returns a NEW builder** — it never mutates; trimming is a query over the prompt, not a step in building it. It drops whole nodes (never truncates text mid-node), least-important first — `low`, then `normal`, then `high` — latest first within a tier. `required` is never dropped; if the required nodes alone exceed the budget it throws `BudgetExceededError` rather than returning something over budget.

`counter` defaults to `approximateTokens` — roughly four characters per token, a rule of thumb for English prose, not a measurement. Pass a real tokenizer when the margin matters. `dialect` must match how the prompt is finally rendered. The standalone form is `applyBudget(nodes, options, dialect)`.

```ts
import { prompt } from "@kasava/prompt-builder";

const full = prompt()
  .priority("required")
  .include(prompt().guidelines(["Answer only from the context."]))
  .priority("low")
  .include(
    prompt().heading("Worked Examples", 2).raw("…long demonstration content…"),
  );

const trimmed = full.$budget({ maxTokens: 16 });

console.log(full.build().length > trimmed.build().length); // true — low dropped
```

---

## The /presets subpath

The domain-shaped generators live at `@kasava/prompt-builder/presets`. Each returns a `PromptBuilder` — compose with `.include()`:

- `toolGuidance(tools, title?)` — tool → usage lookup table
- `gracefulDegradation(rules, title?)` — fallback rules for partial failures
- `followThroughMatrix({ title, description?, rows, postRule })` — action → next-step-offer table
- `analysisRequirements(description, requirements, jsonStructure?)` — numbered requirements spec
- `workedExample(example)` — one `<example>` block
- `workedExamples(examples, title?)` — several, in an `<examples>` wrapper

The same-named class methods are deprecated shims (removed in 1.0) — see [api-fluent.md](api-fluent.md) § Deprecated class methods.

```ts
import { prompt } from "@kasava/prompt-builder";
import { toolGuidance } from "@kasava/prompt-builder/presets";

console.log(
  prompt()
    .role("research agent")
    .include(
      toolGuidance([{ tool: "search", usage: "Find documents by keyword" }]),
    )
    .build(),
);
```

---

## The /zod subpath

`zod` is an optional peer dependency — importing this module fails without it, and the core entry point never touches it. The human installs zod, never the agent.

`createVarsSchema(schema, refinements?)` turns a prompt schema into a Zod object schema matching its render payload. Required variables (`.notNull()`, no `.default()`) are required in the schema; everything else is optional — exactly as `$inferVars` types it (see [api-schema.md](api-schema.md)). Refinement callbacks are typed per variable — `(s) => s.max(80)`, no cast. `json<T>()` has no runtime shape, so it validates as `z.unknown()` — refine it explicitly for untrusted payloads. Use this when the render payload arrives from an untyped source: an HTTP body, a queue message, another model's structured output.

```ts fragment
import { createVarsSchema } from "@kasava/prompt-builder/zod";

const varsSchema = createVarsSchema(userContext, {
  userName: (s) => s.max(80),
});
const vars = varsSchema.parse(requestPayload);
template.render(vars);
```
