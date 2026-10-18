# API Reference — Schema Layer

Typed prompt variables and renderable templates (`definePrompt`), the two `prepare()` paths, the `p` interpolation tag, and the standalone combinators. The fluent builder methods live in [api-fluent.md](api-fluent.md); this page does not restate them.

## Schema — declaring what a prompt needs

`definePrompt(name, vars)` declares a prompt and the variables it renders from. Each entry in `vars` comes from a builder:

| Builder     | Declares      |
| ----------- | ------------- |
| `text()`    | string        |
| `num()`     | number        |
| `bool()`    | boolean       |
| `list()`    | string array  |
| `json<T>()` | arbitrary `T` |

Three modifiers:

- `.notNull()` — required at render time.
- `.default(v)` — fallback value; also makes the variable optional.
- `.$type<U>()` — compile-time retype.

Attach the prompt body with `.body((v) => ...)`, which turns the schema into a renderable `PromptTemplate`:

```ts
import {
  definePrompt,
  text,
  num,
  list,
  bool,
  prompt,
  p,
  when,
} from "@kasava/prompt-builder";

const userContext = definePrompt("user_context", {
  userName: text().notNull(),
  activeShows: list().default([]),
  totalWatched: num().default(0),
  isMobile: bool().default(false),
});

const template = userContext.body((v) =>
  prompt()
    .tag(
      "user_context",
      p`Active shows (${v.activeShows.length}): ${v.activeShows}`,
    )
    .include(when(v.isMobile, "Keep replies short — this is a phone.")),
);

console.log(
  template.render({ userName: "Ada", activeShows: ["Severance", "Andor"] }),
);
```

`.body()` receives resolved vars — required and defaulted keys are guaranteed present, others are `T | undefined`, so the check is forced by types.

`$inferVars` derives the render payload type: a variable is required exactly when it is `.notNull()` and has no `.default()`. Never hand-write the payload type.

---

## Rendering

- `PromptTemplate.render(values, dialect?)` → string; markdown by default. The `dialect` is the same serializer `.build(dialect?)` takes — see [api-fluent.md](api-fluent.md) § Output.
- Throws `MissingVarError` when a required variable is absent.
- `PromptTemplate.toAST(values)` → the resolved `Node[]`.

---

## Prepared prompts

Two different `prepare()` methods exist — do not mix them:

| Method                                     | What it does                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `PromptTemplate.prepare(values, dialect?)` | Binds schema values once, returns a `PreparedPrompt` — for rendering one bound prompt to several dialects. |
| `PromptBuilder.prepare(name?, dialect?)`   | Compiles the built AST; slots (`placeholder()`) stay dynamic.                                              |

```ts
import { prompt, p, placeholder } from "@kasava/prompt-builder";

const greeting = prompt().include(p`Hello ${placeholder("name")}`);
const prepared = greeting.prepare("greeting_v1");

console.log(prepared.params); // ["name"]
console.log(prepared.render({ name: "Ada" })); // "Hello Ada"
```

`.render(values)` on a prepared prompt throws `MissingParamError` for an unbound slot.

The AST walk happens once; repeated renders only fill slots.

---

## The `p` tag

`p` builds a `Fragment` with interpolated values:

| Value                 | Emitted                  |
| --------------------- | ------------------------ |
| string/number/boolean | stringified              |
| array                 | comma-joined             |
| object                | JSON                     |
| null/undefined        | empty string             |
| `Fragment`            | inlined                  |
| `p.raw(x)`            | verbatim                 |
| `placeholder('name')` | a slot, filled at render |

A `PromptBuilder` is not interpolatable — `.include()` it instead; interpolated directly it falls under the object rule and emits its JSON internals.

Multi-line templates are dedented — common indentation is stripped; interpolated values keep their shape.

`p.join(fragments, separator)` concatenates fragments; `p.empty()` produces an empty one.

> **Warning:** `p` provides composition and consistent value serialization — it is NOT an injection defense. Natural language has no grammar to escape out of; treat untrusted input accordingly.

```ts
import { p } from "@kasava/prompt-builder";

const shows = ["Severance", "Andor"];
const fragment = p`
  Active shows (${shows.length}): ${shows}
  Ratio: ${0.62}
  Meta: ${{ kind: "static" }}
  Missing: ${undefined}
  Verbatim: ${p.raw("raw  text")}
`;

console.log(fragment.toString());
```

`Fragment.toString()` throws if a placeholder is unresolved — render through a template or prepared prompt instead.

---

## Combinators

- `when(condition, content)` — include content only when the condition is truthy.
- `unless(condition, content)` — the inverse of `when`.
- `all(...items)` — concatenate everything.
- `any(...items)` — the first entry that produces content; a fallback chain.
- `each(items, (item, index) => Includable)` — map over a collection and concatenate.

All accept `PromptBuilder | Fragment | string | null | undefined | false`. Empty results are dropped outright — unlike `.include()` of an empty builder, which leaves a legacy marker.

`.conditional()` stays as the chained form — see [api-fluent.md](api-fluent.md) § Composition.

```ts
import { prompt, p, all, when, unless, each } from "@kasava/prompt-builder";

const BASE_RULES = prompt().guidelines(["Be direct."]);
const TOOL_SEARCH = prompt()
  .heading("Tool Search", 2)
  .raw("Prefer targeted keyword queries.");
const TOOL_CATALOG = prompt()
  .heading("Tool Catalog", 2)
  .raw("Full list below.");
const toolSearch = true;

console.log(
  all(
    BASE_RULES,
    when(toolSearch, TOOL_SEARCH),
    unless(toolSearch, TOOL_CATALOG),
    each(["alpha", "beta"], (name) => p`- ${name}`),
  ).build(),
);
```
