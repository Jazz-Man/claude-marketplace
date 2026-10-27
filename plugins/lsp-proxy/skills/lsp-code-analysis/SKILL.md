---
name: lsp-code-analysis
description: Use LSP tools for code analysis — symbol lookup, reference finding, type info, navigation — preferring LSP over grep/Read for semantic code understanding. Use whenever analyzing, navigating, refactoring, or reviewing source code: where a symbol is defined, go to definition, find all usages or references, who calls a function, where a type or an import comes from, what implements an interface, or what type something is — and before falling back to grep/Read on any code question. Works in the main session and in subagents alike.
---

# LSP-first Code Analysis

LSP (Language Server Protocol) provides **semantic** code intelligence — types, definitions, references, implementations — that text-based tools (grep, Read) cannot match. Prefer LSP for any task involving code structure, symbols, or type relationships.

## Getting the LSP tool

The LSP tool may be deferred — absent from the tool list until loaded. Load it with ONE ToolSearch call in the exact-name form: query `select:LSP`. Keyword or regex guesses (`definition`, `references`, `language server`) do not match it and waste calls; `select:` resolves by name directly. If other basic tools (Read, Grep, Glob) are deferred too, load them in the same call — `select:LSP,Read,Grep,Glob` — names that do not exist are simply not matched.

## Why LSP over grep/Read

| LSP (semantic) | grep/Read (text) |
|---|---|
| Finds the actual definition of a symbol (even with overloads, generics) | Matches text patterns (false positives on comments, strings, partial names) |
| Resolves type aliases, conditional types, inferred types | Cannot infer types from text |
| Understands scope (local vs exported, shadowed variables) | No scope awareness |
| Returns precise file:line:char locations | Returns approximate matches |

## Locate before reading

Do not open a file just to find something in it — a whole-file Read of a large file costs tokens for lines the task never needs. Map first, read bounded ranges second:

- `documentSymbol` gives the file's structure and the exact line of every symbol.
- For names that are not symbols (import specifiers, string literals), a Grep scoped to that one file returns the line cheaply.
- When a piece of code genuinely must be read, read exactly that range (Read accepts `offset`/`limit`), not the whole file.
- Skip existence pre-checks (`ls`/`find` before acting on a path): point the LSP operation or Read at the path directly — a wrong path fails with an informative error from the tool itself, one signal instead of two calls.

## Retry Rules (server startup + indexing)

LSP servers need time to start and index files:

1. **"server is starting"** → wait 2-3 seconds, retry the same operation
2. **"file not fully indexed"** or **"No hover information available"** → wait 2-3 seconds, retry
3. **Empty result from hover/findReferences** → verify `line` and `character` are ON the symbol name (not whitespace), then retry with corrected position

Max 3 retries. If still empty after 3 retries, the file may have an **indexing quirk** (see Fallback below).

## LSP Operations

| Operation | What it does | Key params |
|---|---|---|
| `goToDefinition` | Find where a symbol is defined | `filePath`, `line`, `character` (ON the symbol) |
| `findReferences` | Find all usages across the project | `filePath`, `line`, `character` (ON the symbol) |
| `hover` | Get type info + documentation | `filePath`, `line`, `character` (ON the symbol) |
| `documentSymbol` | List all symbols in a file | `filePath`, `line=1`, `character=1` |
| `workspaceSymbol` | Search symbols across the project | `query` + `filePath`, `line`, `character` (coords required by the tool but ignored — pass any file + `1`/`1`) |
| `goToImplementation` | Find implementations of an interface/abstract | `filePath`, `line`, `character` |
| `prepareCallHierarchy` | Get call hierarchy item at a position | `filePath`, `line`, `character` |
| `incomingCalls` | Find who calls this function | `filePath`, `line`, `character` |
| `outgoingCalls` | Find what this function calls | `filePath`, `line`, `character` |

### Most reliable operations

- **`workspaceSymbol`** — works across the whole project; most resilient to indexing state.
- **`documentSymbol`** — works on most files; reliable for listing symbols.
- **`findReferences`** — preferred over `incomingCalls` for finding callers (more reliable in complex code). Its result is semantic: string literals, comments, and same-named functions never appear, so once the returned references are classified (calls + declaration + imports), the answer is complete — do not re-sweep the repo with grep to double-check a non-empty classified result. Grep is the fallback when LSP returns empty, not a second opinion.

### Less reliable operations (server-dependent)

- **`incomingCalls`/`outgoingCalls`** — may fail inside IIFE-wrapped, bundled, or very large files. Use `findReferences` as a workaround.
- **`goToDefinition`** — may return "No definition found" when a binding is overwritten (e.g., `x` is a param, then `x = {}` reassigns it).
- **`goToImplementation`** — requires interfaces/classes with type definitions; won't work on untyped/dynamic code.
- **Dynamic dispatch and string-named callbacks** — LSP is structurally blind to calls made through a string: PHP hooks/actions (`add_action('my_func')`), `call_user_func('name')`, dynamically built method names. When the callee is a string, `findReferences` cannot see the call site; grep for the string is the correct tool for these cases, not a workaround.

### External packages (dependencies)

Workspace symbol indexing typically excludes dependency code: a `workspaceSymbol` query for a symbol that lives in an installed dependency returns empty even though the symbol exists — an empty result for a known-existing symbol often means "it lives in a dependency", not "it doesn't exist". The dependency folder differs by ecosystem — JS/TS: `node_modules`, PHP: `vendor/`, Rust: the cargo registry cache, Python: `site-packages` — but the mechanism is the same everywhere: run `goToDefinition` ON the import/use site; it resolves into the dependency's source (or its declaration files, e.g. `.d.ts` for TypeScript), and from there `hover`/`findReferences` work as usual. How far the jump resolves depends on the language server having the dependency's sources available.

### Aliased and re-exported symbols

Hover output beginning with `(alias)` — e.g. `(alias) interface JsonRpcMessage` — marks a symbol imported or re-exported from another module. Never describe it as declared in the current file: run `goToDefinition` on it and report the file it resolves to.

## Coordinate System

- **`line`** is 1-based (first line = 1)
- **`character`** is 1-based (first character on a line = 1)
- For **`documentSymbol`**: use `line=1`, `character=1`
- For **`workspaceSymbol`**: `filePath`+`line`+`character` are REQUIRED by the tool even though only `query` is used semantically — pass any file + `1`/`1` (omitting them fails with `InputValidationError`)
- For **`hover`/`goToDefinition`/`findReferences`**: cursor must be ON the symbol name, not on whitespace before it
- **Tip**: if you don't know exact coordinates, run `documentSymbol` first — it returns symbol locations with line numbers, then use those coordinates

## Workflow Examples

### "Where is symbol X defined?"
1. If you know the line: `LSP goToDefinition(file, line, charOnX)`
2. If you don't know the line: `LSP documentSymbol(file, 1, 1)` → find X → use its line:char
3. If documentSymbol is empty for that file: `LSP workspaceSymbol(file, 1, 1, query: "X")` → find the definition location

### "Who calls function X?"
1. `LSP findReferences(file, lineOfX, charOnX)` — preferred
2. If empty: `LSP workspaceSymbol(file, 1, 1, query: "X")` to confirm the symbol exists, then retry findReferences
3. If still empty: fall back to `Grep` with `pattern: "X("` scoped to source files

### "What type is this variable?"
1. `LSP hover(file, line, charOnVar)` — shows type + documentation

### "List all symbols in a file"
1. `LSP documentSymbol(file, 1, 1)` — returns functions, classes, variables with locations

## When to use non-LSP tools

- **`Glob`** — finding files by name pattern (`**/*.ts`, `src/**/*.go`)
- **`Grep`** — non-symbol text search: string literals, comments, regex patterns, config values, obfuscated identifiers
- **`Read`** — non-code files: JSON, YAML, Markdown, TOML, config, images, binary, `.txt`. Also for reading full file contents when LSP doesn't cover the file type.
- **`Bash`** — running commands (`bun test`, `git`, `npm`), build/test execution. **NEVER** for text processing (sed, awk, cat, head, tail). Use `Grep` or `Read` instead.

## Fallback: when LSP returns empty results

Some files have **indexing quirks** — `documentSymbol`/`hover`/`findReferences` return empty even though symbols exist (verified: `workspaceSymbol` finds the symbol in the same file). This is a per-file indexing state, not a tool failure.

**Strategy:**
1. Try `workspaceSymbol` first (most resilient) — if it finds the symbol, you know LSP is working for that symbol.
2. If `documentSymbol`/`hover`/`findReferences` return empty for a specific file: retry once (indexing may complete). If still empty, fall back per the table below (Grep for reference finding, Read for structure).
3. **Do NOT assume "no references found" means the symbol is unused** — verify with `Grep` if LSP returned empty.

| LSP operation | Fallback (when LSP returns empty) |
|---|---|
| `goToDefinition` | `Grep` with `pattern: "function SYMBOL"` or `"class SYMBOL"` |
| `findReferences` | `Grep` with `pattern: "SYMBOL"` scoped to source files |
| `hover` (type info) | `Read` the file, infer type from context |
| `documentSymbol` | `Read` the file, scan for declarations |
| `workspaceSymbol` | `Grep` with `pattern: "SYMBOL"` across project |

## Diagnostics

LSP servers automatically return diagnostics as `<new-diagnostics>` tags inside LSP tool results. These include:

- Compile errors, type errors, lint warnings (language-server-specific codes)
- Unused variable warnings
- Missing imports

You do NOT need a separate LSP call for diagnostics — they appear automatically when you use any LSP operation on a file. Review the diagnostics in the result to catch issues early.
