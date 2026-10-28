# grepai chunking reference

Scope: how source files split into embeddable chunks, and how to tune it.
Two strategies: `fixed` (default, ships everywhere) and `ast` (syntax-aware;
requires a local build with the treesitter tag + CGO — the owner's build has
it, stock release binaries do NOT and silently fall back to `fixed` with a
warning in the logs).

Tokens are estimated at ~4 characters per token.

## fixed (default)

Sliding window of `size` tokens with `overlap` tokens shared between
neighbors; each window backs up to the last newline inside it, so real
chunks come in at or below the target — never above.

### Tuning

| size | Effect |
|---|---|
| 256–384 | more precise matches, less context (very concise languages: Rust, Zig) |
| 512 | balanced default (concise languages: Go, Python, TS) |
| 768–1024 | more context per result (verbose languages: Java, C#; monolith-sized classes) |

| overlap | Effect |
|---|---|
| 50 (default) | standard boundary continuity |
| 100 | better continuity at function boundaries, ~+10% index |

Rules of thumb from the author, by codebase shape: small functions /
microservices → 384/40; mixed → 512/50; large classes / monolith → 768/100.
Size multiplies chunk count (256/50 roughly doubles the index vs 512/50);
overlap does too, more weakly.

Symptom-driven fixes: fragmented results → raise size; noisy results with
unrelated code in one chunk → lower size; matches cut at function boundaries
→ raise overlap; index too large → lower overlap, raise size, or ignore more.

## ast (syntax-aware; this build)

Parses supported files with tree-sitter and splits along syntax boundaries
(functions, classes, declarations) using the cAST algorithm: small
neighboring nodes merge up to the budget, nodes larger than the budget split
into their children — a chunk is usually a whole function or a group of
related declarations.

- `size` remains the budget, but counted in NON-WHITESPACE characters
  (~4 per token); `overlap` is NOT used by ast.
- Coverage: `.go`, `.py`, `.js`, `.jsx`, `.ts`, `.tsx`. Every other
  extension — and files nested too deeply to split — falls back to the
  fixed chunker automatically.
- Experimental: the ast algorithm may change between grepai releases, which
  can require re-indexing after an upgrade.
- A stock build (or an unknown strategy value) warns and uses `fixed` —
  after any grepai binary swap, check the logs before assuming ast is active.

Choosing between them: with ast available, prefer it for supported languages
(whole-function chunks match intent queries better than windows); keep fixed
for everything else — the fallback handles that per file automatically.

## custom_extensions

Extra indexed extensions beyond the built-in list, each with a leading dot
(e.g. `.tengo`, `.mdx`), matched case-insensitively; an entry missing the
leading dot is silently dropped — no error, no effect. Binary detection
(UTF-8 + null-byte check) still applies, so adding a binary extension is
safe. These files chunk with `fixed`.

## Applying changes

- Changing `size`, `overlap`, or `strategy` does NOT re-chunk what is
  already indexed — a full re-index is required. Never run indexing
  yourself: warn the owner that a rebuild is needed.
- Embedder context limit: if the embedder rejects an oversized chunk, grepai
  splits it in half and retries — up to 3 re-chunking attempts, visible as
  "Re-chunking … context limit exceeded" log lines. Sub-chunks of an ast
  chunk are re-cut by the fixed chunker, losing syntax alignment.

## Pitfalls

1. `overlap: 0` cannot be forced — 0 or missing resets to 50 at load.
   Besides `size` and `ignore`, lowering `overlap` (1-49) also shrinks the
   index, though modestly; zero itself is unattainable.
2. `size: 0` or missing resets to 512; unknown `strategy` values silently
   fall back to `fixed` (warning in logs only).
3. ast reads its budget in non-whitespace characters, not tokens — the same
   numeric `size` yields different real chunk volumes under the two
   strategies.
