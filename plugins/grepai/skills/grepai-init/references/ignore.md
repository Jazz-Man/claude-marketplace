# grepai ignore reference — the five layers and the curation craft

Scope: what keeps files OUT of the index, and — the more interesting half —
how to pull selected files back IN. A file is indexed when it is not
ignored and has a supported extension; grepai always skips binary files,
minified files and files over the size cap. Ignore decides index
membership; ranking inside the index is `search.boost` (see
references/search-boost.md).
Ignore changes always require a re-index; boost changes never do.

## The five layers, in order

1. **`.gitignore`** files at any level of the project — standard semantics.
2. **`ignore` in `.grepai/config.yaml`** — names or gitignore-style
   patterns applied from the project root. The list in the file IS the
   effective list, verbatim: nothing merges at runtime. `grepai init`
   writes the 15 shipped defaults (.git, .grepai, node_modules, vendor,
   bin, dist, __pycache__, .venv, venv, .idea, .vscode, target, .zig-cache,
   zig-out, qdrant_storage) as a STARTING POINT — the owner's list is a
   curation decision: never re-add entries the owner removed (a shorter
   list is usually intentional, and the .gitignore layers still cover the
   big dependency trees); suggest additions only when the project shape
   names something specific. A missing `ignore:` section means NO
   config-layer ignore at all. Entries are names or gitignore-style
   patterns applied from the project root: without a slash a name matches
   at any depth, a leading slash anchors to the root, and a bare directory
   name skips that whole subtree at any depth.
3. **`.grepaiignore`** at any level of the project — gitignore syntax, and
   it takes precedence over `.gitignore`: a `!pattern` re-includes paths
   that the other layers excluded, the config `ignore` list included. One
   boundary: a `.gitignore` in a deeper directory still wins.
4. **`external_gitignore`** — one extra gitignore file outside the
   project, applied from the project root (a leading `~` expands; a
   missing file only warns).
5. **Built-in** — minified files (.min.js, .min.css, .bundle.js,
   .bundle.css) and binary files (unconditional); files over the size cap
   (default 1 MB, `chunking.max_file_size_bytes`, applied after a re-index).

Ignore excludes from BOTH indexes at once — the vector search index and
the trace symbol index (see `trace.md` in the grepai-workflow skill).

Quote globs in YAML (`"*.pb.go"`, not `*.pb.go`) — unquoted special
characters can break parsing.

## .grepaiignore — the curation layer

Use it to exclude files from grepai without touching `.gitignore`, or to
index files that Git ignores. This is also where the solo setup happens:
.gitignore excludes whole dependency trees; `!` negations pull back
exactly the libraries worth trusting.

```
# JS/TS: trust one library's source
!node_modules/<lib>/
node_modules/<lib>/docs/          # re-exclude what is not wanted
node_modules/<lib>/CLAUDE.md

# PHP
!vendor/<lib>/
```

Craft rules:

- A negation overrides a `.gitignore` at the same level or above, and it
  cancels the `ignore` list for that folder: inside a folder that
  `.gitignore` or the `ignore` list ignores, grepai descends and checks
  each file.
- A `.gitignore` in a deeper directory still wins over a shallower
  negation.
- grepai skips a directory that `.grepaiignore` itself ignores without
  looking inside, so a negation below such a directory has no effect —
  exclude the siblings on the path instead (next section).
- A pattern without a leading slash matches the directory NAME at any
  depth — including versioned package-store copies
  (`node_modules/.bun/<lib>@1.2.3/node_modules/<lib>/`). After a store
  cleanup this is harmless; to be immune to duplicates, pin the version or
  anchor the negation to the exact store path. A leading slash ties the
  pattern to the project root.
- A negation can be followed by ordinary exclusions of its sub-paths —
  last match wins, gitignore-style. Re-exclude what is not wanted, or the
  negation brings in that folder's generated files too.
- Rust/Go honesty: dependencies live in global caches outside the project
  tree (~/.cargo/registry, $GOPATH/pkg/mod) — no project-relative pattern
  can reach them. Dependency curation is JS/TS-and-PHP territory; for
  Rust/Go rely on LSP and text search for library questions.

## Index only one folder

To index one folder and leave out the rest of its parent tree, keep the
folders on the way to it out of `.grepaiignore` and exclude the siblings
of each folder on the path instead. This file indexes only the
hand-written documentation pages of a project:

```
/docs/*/
!/docs/src/
/docs/src/*/
!/docs/src/content/
/docs/src/content/*/
!/docs/src/content/docs/

/docs/src/content/docs/commands/
/docs/*.*
/docs/src/*.*
```

Each pair of lines ignores everything inside a folder except the next
folder on the path. The last three lines exclude the generated command
pages, and the files that sit directly in `docs/` and `docs/src/`. Three
shorter versions give the wrong result:

- `docs/*` with `!docs/src/content/docs/*` indexes nothing under `docs/`:
  the first line ignores `docs/src` as well, and grepai does not look
  inside a directory that `.grepaiignore` ignores.
- The same file without the leading slashes indexes the pages — and every
  other `docs/src/content/docs/...` path in the project, even where
  `.gitignore` excludes it.
- The negation without the `commands/` line also cancels `.gitignore` and
  the `ignore` list for that folder, so the generated pages are indexed
  too.

## Ecosystem additions (for the config `ignore` list)

In the same gitignore style, on top of the entries that stay:

- JS/TS: coverage, package-lock.json, yarn.lock, pnpm-lock.yaml,
  "*.bundle.js"
- Go: go.sum, "*.pb.go", "*_mock.go"
- Python: .pytest_cache, .mypy_cache, "*.pyc", "*.egg-info"
- Rust: Cargo.lock (target is already in the defaults)
- Java: .gradle, "*.class", build/ (build name is not a default — add it)
- Monorepo: packages/legacy/, packages/deprecated/

## Shaping the list at init

`grepai init` writes the same 15 entries into every project, whatever its
ecosystem. At init the list is yours to shape; in a config the owner has
already curated, leave it as it is.

- Keep `.git` and `.grepai`.
- Keep a shipped entry only when this project has, or can grow, what it
  names — its dependency folder, its build output, its caches — and no
  gitignore layer excludes it already.
- Add the agent and editor artifacts of the project (next section).
- Drop the rest: `vendor`, `__pycache__`, `.venv`, `venv`, `target`,
  `.zig-cache`, `zig-out`, `qdrant_storage` and the like name other
  ecosystems. In a project without them they are noise, and a list of
  noise hides the entries that matter.

A TypeScript project on Bun whose `.gitignore` already excludes
`node_modules` ends with a short list: `.git`, `.grepai`, `bin` where it
has one, the agent and editor names, and nothing for Python, Rust, Zig or
Qdrant.

## Agent and editor artifacts (at init)

The index should hold the project's code, not the instructions and state
of the tools that read it. Add to the config `ignore` list — unless git
already ignores the name (`git check-ignore -q <name>` exits 0; the
`.gitignore` and `external_gitignore` layers then exclude it anyway). In
a project that is not a git repository, search the project's `.gitignore`
files and the global gitignore for the name instead — grepai reads both
with or without git:

- the agent files `CLAUDE.md` and `AGENTS.md`;
- the agent directories `.claude` and `.agents`;
- the editor directories `.zed` and `.idea` (`.vscode` ships in the
  defaults);
- any other agent-tool or editor directory the project root actually has.

A bare name matches at any depth, so `.claude` covers
`packages/app/.claude` as well. The base names go in whether or not the
file exists today: `AGENTS.md` is added before anyone creates it. This is
the basic set; the owner curates the rest while working with grepai.

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
  reflects it — unlike boost, which applies to the next search. The
  watcher builds its ignore rules once, when it starts, so a running
  `grepai watch` has to be restarted as well. Never index or restart
  anything — warn the owner that a re-index (and a watcher restart, if
  watch runs) is needed.
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
5. A negation placed under a directory that `.grepaiignore` ignores does
   nothing — grepai never looks inside that directory.
