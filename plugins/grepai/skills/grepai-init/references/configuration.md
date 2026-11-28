# grepai configuration reference

Scope: a solo-developer profile — local Ollama embedder, GOB store, one
machine. This file follows the grepai documentation. The copy of grepai's
own schema in references/config.schema.json is there for key names and
valid ranges; where its wording differs from the documentation, the
documentation wins.

Config lives at `.grepai/config.yaml` at the project root, created by
`grepai init` with defaults. Every command loads the nearest one: the
current directory first, then each parent.

## How the file is loaded

1. **Defaults are filled.** A missing or zero value takes the default in
   the tables. Four things are not filled and stay as written:
   `embedder.provider`, `embedder.model`, `store.backend` and the `ignore`
   list. The whole `search` section has no load-time defaults — without
   it, boost, hybrid search and deduplication are all off.
2. **Values are validated.** The four `watch.rpg_*` values on every load,
   the `rpg` values when `rpg.enabled` is true. A value outside its range
   stops the command with a message that names the key.
3. **Unknown keys are ignored**, and dropped the next time the file is
   saved. `grepai watch` and `grepai index` save it after each successful
   index save, so a key this version does not know disappears from it.
   The same writes store `watch.last_index_time`: expect the file to
   change after the owner's index run.

An empty `embedder.provider` (`unknown embedding provider`) or
`store.backend` (`unknown storage backend`) fails at startup. No value in
the file expands environment variables: `api_key: ${OPENAI_API_KEY}` is
sent literally. `trace.mode`, `trace.exclude_patterns`,
`update.check_on_startup` and `rpg.store_path` never had any effect.

| File in `.grepai/` | Written by | Contents |
|---|---|---|
| `config.yaml` | `grepai init`, later rewritten by `grepai watch` and `grepai index` | The configuration |
| `index.gob` | indexing, with the `gob` store | Vector index |
| `symbols.gob` | indexing | Symbol index used by trace, refs and the RPG |
| `rpg.gob` | indexing, when `rpg.enabled` is true | The Repository Planning Graph |
| `index-meta.json` | indexing | The embedder an index was built with; a mismatch makes `grepai index` and `grepai watch` rebuild the index and `grepai search` refuse the stale one |
| `stats.json` | `grepai search` and `grepai trace` | Token savings shown by `grepai_stats` |
| `writer.lock` | `grepai watch`, `grepai index` | Lock that admits one writer per project |

## The solo baseline

```yaml
version: 1
embedder:
  provider: ollama
  model: bge-m3
  endpoint: http://localhost:11434
  dimensions: 1024              # MUST match what the model returns
  request_timeout_seconds: 60   # raise for a shared/slow GPU
store:
  backend: gob                  # .grepai/index.gob, per-project
chunking:
  size: 512
  overlap: 50
  strategy: ast                 # needs a treesitter build; else falls back to fixed
search:
  boost:
    enabled: true               # keep the rule lists non-empty — see pitfalls
  hybrid:
    enabled: true               # default is false; see the cost note
  dedup:
    enabled: true
trace:
  enabled_languages: [".ts", ".tsx", ".js", ".jsx"]   # this project's languages
rpg:
  enabled: true                 # default is false; the index builds the graph
external_gitignore: ~/.gitignore   # the owner's global gitignore
```

`grepai init --yes` writes nomic-embed-text at 768d with `fixed` chunking
and hybrid off; the baseline is four edits away: `embedder.model`,
`embedder.dimensions`, `chunking.strategy`, `search.hybrid.enabled`.

## embedder

| Key | Default | What it does |
|---|---|---|
| `provider` | `ollama` | One of `ollama`, `lmstudio`, `openai`, `openrouter`, `synthetic`, `requesty`. Not filled; empty or unknown fails at startup. |
| `model` | the provider's default | Model name sent to the provider. Not filled. |
| `endpoint` | the provider's default | Base URL of the provider's API. |
| `api_key` | empty | Key for the cloud providers. Empty: grepai reads the provider's environment variable, and only for the official endpoint. A key set here is stored in plain text and wins over the environment. |
| `dimensions` | `768` for `ollama`, `lmstudio`, `synthetic`; unset for the rest | Vector size. Must match what the model returns. Part of the embedder identity in `index-meta.json`, so changing it rebuilds the index. |
| `parallelism` | `4` | Concurrent requests. `openai` only. |
| `request_timeout_seconds` | `60` (90 for `synthetic`) | HTTP timeout for one request. Every provider except `requesty`. Raise it for a slow self-hosted endpoint. |
| `max_retries` | `5` | Retries on HTTP 429 and 5xx. `openai` only. |
| `max_batch_size` | `2000` | Inputs per request. `openai` only. |
| `max_batch_tokens` | `280000` | Estimated tokens per request. `openai` only. |

| Provider | Default model | Default endpoint | Default dimensions | API key environment variable |
|---|---|---|---|---|
| `ollama` | `nomic-embed-text` | `http://localhost:11434` | 768 | none |
| `lmstudio` | `text-embedding-nomic-embed-text-v1.5` | `http://127.0.0.1:1234` | 768 | none |
| `openai` | `text-embedding-3-small` | `https://api.openai.com/v1` | model's native size | `OPENAI_API_KEY` |
| `openrouter` | `openai/text-embedding-3-small` | `https://openrouter.ai/v1` | model's native size | `OPENROUTER_API_KEY`, then `OPENAI_API_KEY` |
| `synthetic` | `hf:nomic-ai/nomic-embed-text-v1.5` | `https://api.synthetic.new/openai/v1` | 768 | `SYNTHETIC_API_KEY`, then `OPENAI_API_KEY` |
| `requesty` | `openai/text-embedding-3-small` | `https://router.requesty.ai/v1` | model's native size | `REQUESTY_API_KEY`, then `OPENAI_API_KEY` |

- Ollama models and their sizes: `nomic-embed-text` 768 (English, the
  default), `nomic-embed-text-v2-moe` 768 (multilingual), `bge-m3` 1024
  (multilingual), `mxbai-embed-large` 1024, `all-minilm` 384. A model
  other than the provider's default needs `dimensions` set to match.
- For `openai`, `openrouter` and `requesty`, leave `dimensions` unset for
  the model's native size: 1536 for `text-embedding-3-small`, 3072 for
  `text-embedding-3-large`, 4096 for `qwen/qwen3-embedding-8b`.
- An environment key is only sent to the provider's official endpoint over
  HTTPS. A custom endpoint (Azure, LiteLLM, vLLM, a proxy) needs `api_key`
  in the config; left empty while an environment key is set, grepai stops
  with an error that names the endpoint. A local server that needs no key
  still needs a placeholder, such as `api_key: unused`.
- Changing `provider`, `model` or `dimensions` is detected from
  `index-meta.json`: `grepai search` refuses the old index and says so,
  and `grepai index` or `grepai watch` remove the old vectors and re-embed
  every file. The endpoint is not part of that identity. The owner stops a
  background watcher (`grepai watch --stop`) and runs `grepai index`.

## store

| Key | Default | What it does |
|---|---|---|
| `backend` | `gob` | `gob`, `postgres` or `qdrant`. Not filled; empty fails at startup. Workspaces accept `postgres` and `qdrant` only. |
| `postgres.dsn` | `postgres://localhost:5432/grepai` | Connection string, written directly — no environment variable, no `${VAR}` expansion. |
| `qdrant.endpoint` | `localhost` | Qdrant host or base URL; a scheme, port or path in the value is ignored. |
| `qdrant.port` | `6334` | gRPC port. |
| `qdrant.collection` | project path | Collection name; empty derives it from the project path. |
| `qdrant.api_key` | empty | API key for Qdrant Cloud. |
| `qdrant.use_tls` | `false` | The only setting that turns TLS on. |

One developer, one project: keep `gob` — a single file `.grepai/index.gob`,
nothing to install, not shareable. More than about 50,000 chunks:
`qdrant` — a `gob` index is loaded and scanned in full on every search,
and grepai warns after indexing past that size. An index shared by several
machines, worktrees or projects, or a workspace: `postgres` or `qdrant`.
The backend is picked at init (`grepai init --backend qdrant`), and both
remote stores need a server the owner runs.

## chunking

| Key | Default | What it does |
|---|---|---|
| `size` | `512` | Chunk budget in tokens, estimated at 4 characters per token. With `ast`, counted in non-whitespace characters. |
| `overlap` | `50` | Tokens shared between neighboring chunks. Not used by `ast`; `0` cannot be set. |
| `strategy` | `fixed` | `fixed` or `ast`. An unknown name, or `ast` in a build without tree-sitter, falls back to `fixed` with a warning. |
| `custom_extensions` | empty | Extra extensions to index, each with the leading dot, matched case-insensitively. These files use the fixed chunker. |
| `max_file_size_bytes` | `1048576` | Largest file size that is indexed. Applies to full scans and watcher updates, after a re-index. |

A change to any `chunking` key applies after a re-index, and only to files
that changed since. To apply it to the whole project, the owner deletes
the index (`rm .grepai/index.gob` with GOB) and runs `grepai index` again.
Tuning tables and strategies: references/chunking.md.

## framework_processing

Single-file components go through a Node.js compiler before they are
chunked and traced; line numbers are mapped back to the original file.

| Key | Default | What it does |
|---|---|---|
| `enabled` | `true` | Master switch. `false` turns processing off, whatever `mode` says. |
| `mode` | `auto` | `auto`: compiled output when the processor works, otherwise the raw file and a warning. `require`: stop with an error when a processor does not work. `off`: do not process. |
| `node_path` | `node` | Node.js for the Vue processor: a command name resolved through `PATH`, or a local absolute path outside the project and its git repository. Anything else is ignored with a warning. |
| `frameworks.vue.enabled` | `true` | Vue single-file components, compiled to TypeScript. |
| `frameworks.svelte.enabled`, `frameworks.astro.enabled`, `frameworks.solid.enabled` | `false` | Placeholders: those processors are not implemented. |

The Vue processor loads `@vue/compiler-sfc` from the project's own
`node_modules`, which runs code from the repository. Disable it before
indexing a repository you do not trust.

## watch

| Key | Default | What it does |
|---|---|---|
| `debounce_ms` | `500` | Wait after the last file event before pending events are processed. One timer for all files; a steady stream of events postpones processing until it pauses. |
| `last_index_time` | written by grepai | Timestamp of the last indexing pass. grepai reads and rewrites it; never edit it. |
| `discover_worktrees` | `true` | Watch linked git worktrees too. Read from the main worktree's config only. Takes effect without a restart. |
| `rpg_derived_debounce_ms` | `300` (minimum `100`) | How often the watcher checks for files whose RPG edges need a rebuild. |
| `rpg_persist_interval_ms` | `1000` (minimum `200`) | How often the RPG graph is saved when it has unsaved changes. |
| `rpg_full_reconcile_interval_sec` | `300` (minimum `30`) | How often the RPG rebuilds all of its call, import and similarity edges. |
| `rpg_max_dirty_files_per_batch` | `128` (minimum `1`) | Changed files the RPG processes per check; more than that between two checks makes the next one a full rebuild. |

The four `rpg_*` keys are validated on every load but only take effect
when `rpg.enabled` is true. The watcher reads every key except
`discover_worktrees` — and the ignore rules and the rest of the config —
when it starts: after a config change it has to be restarted.

## search

| Key | Default | If omitted | What it does |
|---|---|---|---|
| `boost.enabled` | `true` | off | Apply the boost rules to the scores. |
| `boost.penalties` | 17 rules | empty | Lower the score of matching paths; `pattern` and `factor` entries. |
| `boost.bonuses` | 3 rules | empty | Raise the score of matching paths. |
| `hybrid.enabled` | `false` | off | Combine vector search with word matching. |
| `hybrid.k` | `60` | `0`, treated as `60` | Constant of the rank fusion. |
| `dedup.enabled` | `true` | off | Keep only the best-scoring chunk of each file. |

These apply to `grepai search` and the MCP search tool in single-project
mode; workspace searches use the built-in defaults. A `penalties` or
`bonuses` list replaces the default list, and an empty list applies no
rules. Hybrid loads all chunks on every query — fine on a solo gob index,
costly on large ones. Rules and craft: references/search-boost.md.

## trace

| Key | Default | If omitted | What it does |
|---|---|---|---|
| `trace.enabled_languages` | 27 extensions | the default list | File extensions to extract symbols from, each with the leading dot. They must be ones the extractor knows. |

Call graphs and property refs are built from this list. An empty list
falls back to the defaults. The regex extractor is the only one indexing
uses; `.vue` goes through `framework_processing`; extensions outside its
coverage are indexed but yield no symbols. To keep files out of every
index, including the symbol index, use the top-level `ignore` list.

## rpg

| Key | Default | If omitted or `0` | What it does |
|---|---|---|---|
| `enabled` | `false` | `false` | Build and keep the graph in `.grepai/rpg.gob`. With it on, `grepai search` and `grepai trace` results show a feature path. |
| `feature_mode` | `local` | `local` | `local` derives feature labels from symbol names with heuristics. `llm` and `hybrid` run the same code: they ask a chat model instead, and fall back to `local` when `llm_model` or `llm_endpoint` is empty. |
| `drift_threshold` | `0.35` | `0.35`, so `0.0` cannot be set | A changed file moves to another place in the hierarchy only if its features changed by at least this much. Range `0.0` to `1.0`. |
| `feature_group_strategy` | `sample` | `sample` | How groups of similar symbols larger than 100 are cut down: `sample` keeps a random 100, `split` makes one group per directory. Applied at each full rebuild. |
| `llm_model` | empty | empty | Chat model for `llm` and `hybrid`. |
| `llm_endpoint` | `http://localhost:11434/v1` | the default | Base URL of an OpenAI-compatible chat API. |
| `llm_api_key` | empty | empty | API key for that API. |
| `llm_timeout_ms` | `8000` | `8000` | Timeout for one request to the chat model. |
| `llm_provider` | `ollama` | `ollama` | Label shown in the watcher status output. It does not change which endpoint is called. |
| `max_traversal_depth` | `3` | `3` | Accepted for compatibility. It has no effect. |

Validated when `enabled` is true: `drift_threshold` outside `0.0`–`1.0`,
`max_traversal_depth` above `10`, or any other mode or strategy than the
listed ones stops every command with a message that names the key. The
graph is built at index time from the `trace` languages; how it follows
edits is set by the `watch.rpg_*` keys.

## ignore and external_gitignore

| Key | Default | If omitted | What it does |
|---|---|---|---|
| `ignore` | 15 names | no config-layer ignore at all | Names or gitignore-style patterns skipped everywhere in the project. A list you write replaces the default list; it is not merged with it. |
| `external_gitignore` | empty | none | Path of one more gitignore file, applied from the project root. A leading `~` expands to the home directory. A missing file only logs a warning. |

The sources, their precedence, the negation craft and the owner-curation
rule live in references/ignore.md.

## Solo pitfalls

1. `dimensions` that do not match the model → embedder identity mismatch →
   index rebuild. bge-m3 = 1024.
2. A missing `search:` section means boost, hybrid and dedup are OFF —
   search has no load-time defaults. Keep the block that `grepai init`
   wrote.
3. Empty `penalties:`/`bonuses:` lists are an empty rule set, not "use
   defaults" — boost becomes a no-op.
4. Chunking, ignore, trace, RPG and embedder changes show only after the
   owner's index run; boost, hybrid and dedup apply to the next search.
5. watch `rpg_*` keys are validated at every load — one bad value breaks
   every grepai command.
6. gob is per-project and not shareable; multi-project workspaces require
   postgres or qdrant.
7. The watcher never reloads the config — after any change to a project
   that runs `grepai watch`, the owner restarts it.
8. The Vue processor runs code from the project's `node_modules`.
