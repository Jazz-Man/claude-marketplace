---
name: prompt-builder
description: Build and edit prompts using @kasava/prompt-builder. Covers method selection, the pure-builder pattern, safety, anti-patterns, and abstract examples.
---

# Prompt Builder Skill

Use this skill when building, editing, or reviewing prompts that use `@kasava/prompt-builder`. The library provides a fluent builder plus a schema layer, a template tag, combinators, and pluggable output dialects. This skill is **library-focused and project-agnostic** — it teaches how to use the library correctly, not how any particular project's prompts are organized.

## Workflow

1. **Analyze** — What kind of prompt? (scoring/classification, tool-using agent, multi-step analysis, Q&A, code/diff review, context-heavy, conditional, composable) Then the four routing questions: runtime data? repeated renders? non-markdown output? token budget?
2. **Select architecture** — See [architectures.md](references/architectures.md) for the four structures (static builders, schema templates, prepared prompts, AST pipelines) and the picking table
3. **Build** — With the matching API file: [api-fluent.md](references/api-fluent.md) for builder methods, [api-schema.md](references/api-schema.md) for variables/templates/`p`, [api-output.md](references/api-output.md) for dialects/messages/budget
4. **Review** — Check against [best-practices.md](references/best-practices.md) and [anti-patterns.md](references/anti-patterns.md)

## Where to look

| I need…                            | See                                             |
| ---------------------------------- | ----------------------------------------------- |
| Fluent method lookup               | [api-fluent.md](references/api-fluent.md)       |
| Variables/templates/render         | [api-schema.md](references/api-schema.md)       |
| Dialects/messages/cache/budget/AST | [api-output.md](references/api-output.md)       |
| Structuring prompt code            | [architectures.md](references/architectures.md) |
| Pattern by prompt type             | [patterns.md](references/patterns.md)           |
| Copy-paste starter                 | [examples.md](references/examples.md)           |

## Quick Reference

| Prompt Need                   | Method(s)                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Agent persona                 | `.role()`                                                                                        |
| Multi-step process            | `.protocol()`                                                                                    |
| Numbered investigation phases | `.investigationStrategy()`                                                                       |
| Decision rules                | `.arrowRules()`                                                                                  |
| Two-column reference / rubric | `.lookupTable()`                                                                                 |
| Tiered classification         | `.severityScale()`                                                                               |
| Confidence tiers              | `.confidenceScale()`                                                                             |
| Tool usage guidance           | `toolGuidance` from `/presets` + `.include()` (class shim removed in 1.0)                        |
| Action → follow-up matrix     | `followThroughMatrix` from `/presets` + `.include()` (class shim removed in 1.0)                 |
| Error handling                | `gracefulDegradation` from `/presets` + `.include()` (class shim removed in 1.0)                 |
| Pre-return checks             | `.verificationChecklist()`                                                                       |
| Behavioral rules              | `.guidelines()`                                                                                  |
| Analysis requirements         | `analysisRequirements` from `/presets` + `.include()` (class shim removed in 1.0)                |
| Worked examples               | `workedExample(s)` from `/presets` + `.include()` (class shim removed in 1.0)                    |
| Context injection             | `.context()`, `.data()`                                                                          |
| Instructions wrapper          | `.instructions()`                                                                                |
| Conditional sections          | `.conditional()`                                                                                 |
| Reusable fragments            | `section()` + `.include()`                                                                       |
| File list with stats          | `.filesList()`                                                                                   |
| Diff display                  | `.diffBlock()`                                                                                   |
| Simple output fields          | `.outputFormat()` _(flat field list — see [api-fluent.md](references/api-fluent.md) for limits)_ |
| Runtime variables             | `definePrompt` + `.render()` — [api-schema.md](references/api-schema.md)                         |
| Interpolation                 | ``p`…` `` + `placeholder()` — [api-schema.md](references/api-schema.md)                          |
| Conditional fragments         | `when`/`unless`/`all`/`any`/`each` — [api-schema.md](references/api-schema.md)                   |
| Chat output + caching         | `toMessages()` + `.cacheBoundary()` — [api-output.md](references/api-output.md)                  |
| Token trimming                | `.priority()` + `.$budget()` — [api-output.md](references/api-output.md)                         |

> Quick Reference maps a single need → one method. For a whole prompt type → a method chain, see [patterns.md](references/patterns.md). The `/presets` functions are documented in [api-output.md](references/api-output.md).

## Key Rules

1. **Always start with `.role()`** — sets the persona in one line (`You are a/an {title}{, task}.`)
2. **Use generators, not basic methods** — `.protocol()` over `.heading()` + `.list()`; `.arrowRules()` over manual formatting
3. **Builders are pure synchronous functions** — take their data as parameters (including file contents already read by the caller) and return a `PromptBuilder` (or call `.build()` to return a string). Keep file I/O and other side effects OUT of the builder; the caller reads files and passes the content in. This makes builders deterministic, fast, and trivially testable. **Avoid `async`, `Promise<string>`, and `Bun.file()` / `fs.readFile` inside a builder.** `.render()` is pure too — still no I/O inside builders; the caller reads files and passes content in.
4. **Wrap final instructions in `.instructions()`** — the `<instructions>` XML tag gives a clear signal to the model
5. **`.outputFormat()` is a flat field spec** — `[{field, type, description}]` bullets; it can't represent rich JSON Schemas. For rich schema output, inject the schema directly. See [api-fluent.md](references/api-fluent.md) and [anti-patterns.md](references/anti-patterns.md).
6. **Tag-emitting methods are single-use (except the example family)** — `.context()`, `.data()`, `.instructions()`, … each emit one fixed-name tag. Call each at most once per prompt; for several distinct sources use `.tag(uniqueName, content)`. The example family is exempt. Details in [anti-patterns.md](references/anti-patterns.md).
7. **Generators emit their own heading** — `.protocol`/`.arrowRules`/`.lookupTable`(titled)/`.severityScale`/`.guidelines`/the `/presets` functions/… each render `##` (`.severityScale()` renders `###`). Don't prepend `.heading()` — it makes two consecutive `##`. It's fine only when the next method emits no heading. Full exceptions in [anti-patterns.md](references/anti-patterns.md).
8. **`.raw()` for prose, tag methods for data** — `.data()`, `.context()`, `.instructions()` wrap content in XML tags. For a plain paragraph use `.raw()` (no formatting); reserve `.data()` for input schema/shape descriptions.
9. **`p` is composition and serialization, not an injection defense** — treat untrusted input accordingly; see [api-schema.md](references/api-schema.md) § The `p` tag.
10. **`$budget()` returns a new builder — it never mutates the one it trims** — trimming is a query over the prompt, not a build step; see [api-output.md](references/api-output.md) § Token budget.
11. **0.3 output is the corrected format** (escaped table cells, empty-rows `lookupTable` skips its table); **pre-0.3 bytes require `markdown({ strict: true })`** — see [api-output.md](references/api-output.md) § Dialects.

## Builder shape

A builder is a pure function. Inputs come in as arguments; the builder never does I/O.

```ts fragment
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";

// Return PromptBuilder when the caller composes/extends it:
export function buildAnalyzerPrompt(data: AnalyzerInput): PromptBuilder {
  return prompt()
    .role("data analyzer")
    .context(data.background) // caller already read the file
    .protocol({/* steps */})
    .instructions("Analyze and return the result.");
}

// Or return the finished string for standalone use:
export function buildSimplePrompt(question: string): string {
  return prompt().role("assistant").raw(question).build();
}
```

Each builder:

- Exports a `build*Prompt()` function
- Takes its data as parameters (strings, configs, already-read file contents)
- Returns a `PromptBuilder` (composable) or a `string` (standalone)
- Can be tested standalone: `buildX(testData).build()`

## Reference Files

- [api-fluent.md](references/api-fluent.md) — consult when you need a method's exact signature, output, or skip rules
- [api-schema.md](references/api-schema.md) — consult when declaring variables, rendering templates, interpolating with `p`, or using prepared prompts and combinators
- [api-output.md](references/api-output.md) — consult when choosing an output dialect, splitting chat messages with cache boundaries, inspecting the AST, trimming to a token budget, or using `/presets` and `/zod`
- [architectures.md](references/architectures.md) — consult when deciding how to structure prompt code (static builders, schema templates, prepared prompts, AST pipelines)
- [patterns.md](references/patterns.md) — consult when choosing methods for a whole prompt type (scoring, agent, analysis…)
- [best-practices.md](references/best-practices.md) — consult when reviewing a prompt for safety, clarity, structure, token cost
- [anti-patterns.md](references/anti-patterns.md) — consult when checking for common mistakes (duplicate tags, duplicate headings, I/O in builders)
- [examples.md](references/examples.md) — consult for a copy-paste starting point by prompt type
