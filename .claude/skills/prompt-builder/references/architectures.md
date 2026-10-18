# Architectures

Four ways to structure prompt code around the library. A menu, not a hierarchy — they combine. Pick per project; nothing here is a prescription.

---

## Static builder functions

**When** — no runtime variables, few consumers.

**How** — `export function buildX(data: Input): string` wrapping a `prompt()` chain (see [examples.md](examples.md)).

**Pros** — zero ceremony, pure and synchronous.

**Cons** — the data contract is only a hand-written `Input` type; interpolation is manual.

**How to test** — call with fixture data, snapshot the string.

```ts
import { prompt } from "@kasava/prompt-builder";

export function buildReviewerPrompt(document: string): string {
  return prompt().role("reviewer").tag("document", document).build();
}
```

---

## Schema templates

**When** — runtime data, several call sites, untrusted/external payload sources.

**How** — `definePrompt(...).body(v => ...)` + `.render(values)`; `$inferVars` is the contract. Variables, defaults, and `$inferVars` are documented in [api-schema.md](api-schema.md).

**Pros** — typed payload, `MissingVarError` guard, combinators see resolved values.

**Cons** — more ceremony than a one-off deserves.

**How to test** — `render()` with fixture vars; assert the thrown `MissingVarError` for a missing required var.

```ts
import { definePrompt, text, prompt } from "@kasava/prompt-builder";

const reviewer = definePrompt("reviewer", { document: text().notNull() }).body(
  (v) => prompt().role("reviewer").tag("document", v.document),
);

reviewer.render({ document: "…" });
```

---

## Prepared prompts

**When** — the same large prompt renders on every request, or one bound prompt goes to several dialects.

**How** — `template.prepare(values)` / `builder.prepare(name)` → `PreparedPrompt.render(slots)`. The two `prepare()` paths are documented in [api-schema.md](api-schema.md) § Prepared prompts.

**Pros** — AST walk paid once; slots only on re-render; the static half is stable for cache boundaries.

**Cons** — one more indirection; slots are untyped (`Record<string, unknown>`).

**How to test** — `params` lists the expected slots; renders with fixture slots.

```ts
import { prompt, p, placeholder } from "@kasava/prompt-builder";

const prepared = prompt()
  .include(p`Summary of ${placeholder("topic")}`)
  .prepare("v1");
prepared.render({ topic: "caching" });
```

---

## AST pipelines

**When** — introspection, structural diffing, token trimming, custom serialization.

**How** — `.toAST()` / `walk()` / `applyBudget` / custom `Dialect` — see [api-output.md](api-output.md); `.node()` feeds a raw `Node` into the builder chain ([api-fluent.md](api-fluent.md)).

**Pros** — full programmatic access; budget keeps output well-formed.

**Cons** — couples code to the node shapes.

**How to test** — walk-based assertions (node counts, kinds) rather than string matching.

```ts
import { prompt } from "@kasava/prompt-builder";

const ast = prompt().role("agent").guidelines(["Be direct."]).toAST();
console.log(ast.map((n) => n.kind).join(","));
```

---

## Picking one

Read the project against the columns; the matching row names where to start. Rows combine the same way the architectures do.

| Runtime data? | Repeated renders? | Cache boundaries matter? | Introspection or trimming? | Consumers          | Starting point                           |
| ------------- | ----------------- | ------------------------ | -------------------------- | ------------------ | ---------------------------------------- |
| No            | No                | No                       | No                         | Few                | Static builder functions                 |
| Yes           | No                | No                       | No                         | Several call sites | Schema templates                         |
| —             | Yes               | Yes                      | No                         | —                  | Prepared prompts                         |
| —             | —                 | —                        | Yes                        | —                  | AST pipelines                            |
| Yes           | Yes               | Yes                      | No                         | Several call sites | Schema templates, prepared after binding |

a starting point, not a prescription.
