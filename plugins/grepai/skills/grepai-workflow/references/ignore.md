# grepai ignore reference — the five layers and the curation craft

Scope: what keeps files OUT of the index, and — the more interesting half —
how to pull selected files back IN. Ignore decides index membership;
ranking inside the index is `search.boost` (see references/search-boost.md).
Ignore changes always require a re-index; boost changes never do.

## The five layers, in order

1. **`.gitignore`** files — root and subdirectories, standard semantics.
2. **`.grepaiignore`** — same syntax as .gitignore, plus `!` negations that
   RE-INCLUDE paths excluded by any other layer, including the config
   `ignore` list below.
3. **`ignore` in `.grepai/config.yaml`** — entries match as directory/file
   NAMES (skips the subtree at any depth) and as gitignore-style patterns;
   setting the list REPLACES the shipped defaults (.git, .grepai,
   node_modules, vendor, bin, dist, __pycache__, .venv, venv, .idea,
   .vscode, target, .zig-cache, zig-out, qdrant_storage) — copy them and
   append.
4. **`external_gitignore`** — one extra gitignore file applied from the
   project root (`~/` expansion supported; a missing file only warns).
5. **Built-in** — minified files (.min.js, .min.css, .bundle.js,
   .bundle.css), files over 1 MB, binary files. Not configurable.

Ignore excludes from BOTH indexes at once — the vector search index and
the trace symbol index (see references/trace.md).

Quote globs in YAML (`"*.pb.go"`, not `*.pb.go`) — unquoted special
characters can break parsing.

## .grepaiignore — the curation layer

This is where the solo setup happens: .gitignore excludes whole dependency
trees; `!` negations pull back exactly the libraries worth trusting.

```
# JS/TS: trust one library's source
!node_modules/<lib>/
node_modules/<lib>/docs/          # re-exclude what you do not want
node_modules/<lib>/CLAUDE.md

# PHP
!vendor/<lib>/
```

Craft rules, all live-tested:

- A pattern WITHOUT a leading slash matches the directory NAME at any
  depth — including versioned package-store copies
  (`node_modules/.bun/<lib>@1.2.3/node_modules/<lib>/`). After a store
  cleanup this is harmless; to be immune to duplicates, pin the version or
  anchor the negation to the exact store path.
- A leading slash anchors to the project root.
- A negation can be followed by ordinary exclusions of its sub-paths —
  last match wins, gitignore-style.
- Rust/Go honesty: dependencies live in global caches outside the project
  tree (~/.cargo/registry, $GOPATH/pkg/mod) — no project-relative pattern
  can reach them. Dependency curation is JS/TS-and-PHP territory; for
  Rust/Go rely on LSP and text search for library questions.

## Ecosystem additions (on top of the defaults)

- JS/TS: coverage, package-lock.json, yarn.lock, pnpm-lock.yaml,
  "*.bundle.js"
- Go: go.sum, "*.pb.go", "*_mock.go"
- Python: .pytest_cache, .mypy_cache, "*.pyc", "*.egg-info"
- Rust: Cargo.lock (target is already in the defaults)
- Java: .gradle, "*.class", build/ (build name is not a default — add it)
- Monorepo: packages/legacy/, packages/deprecated/

## Ignore vs boost — the division

- IGNORE what the project does not own at all: uncurated dependencies,
  build output, caches, lock files.
- PENALIZE (boost) what the project owns but ranks below source: tests,
  fixtures, docs. Never exclude tests via ignore — they stay searchable,
  ranked low by references/search-boost.md.
- Declaration files (.d.ts and the like) are often VALUE, not noise — under
  curation they are the trusted API surface of a dependency; do not ignore
  them by reflex.

## Applying and verifying

- Every ignore change (any layer) requires a re-index before the index
  reflects it — unlike boost, which applies to the next search.
- Verify by file count: `grepai_index_status { root }` before and after a
  re-index; a successful curation shows a small increase (the re-included
  library) or a large drop (a corrected exclude), never silence.
- A file the index never saw is invisible to every query and every trace —
  rule the layers out before concluding code does not exist.

## Pitfalls

1. Substring thinking — config `ignore` matches names and gitignore-style
   patterns, NOT arbitrary substrings of paths; `/tests/`-style
   any-substring matching is boost semantics, a different layer.
2. Custom `ignore:` lists replace the defaults silently — a short custom
   list can re-admit node_modules and vendor into the index.
3. A negation matches more than intended when the same directory name
   exists at several depths (package stores, workspaces).
4. Expecting ignore changes to apply without a re-index.
