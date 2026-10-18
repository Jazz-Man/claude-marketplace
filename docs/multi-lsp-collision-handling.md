# How Claude Code handles multiple LSP servers per file type

Date: 2026-10-06. Environment: Claude Code CLI, macOS, two enabled LSP-bearing plugins — `vtsls@claude-code-lsps` (user scope) and `biome-lsp@sdd-local` (this repo, directory marketplace `sdd-local`). Symptom under study: the `/plugin` Errors tab shows 6 notes — `LSP server "biome" is not used for <ext> files — plugin "vtsls" already registered a server for that extension` — for `.ts/.tsx/.js/.jsx/.mjs/.cjs`.

Method: two independent docs-mining passes over code.claude.com (2026-10-06) plus one live-experiment session with both plugins enabled. Every rule cites an exact doc sentence with its page key, or "live experiment, 2026-10-06". Anything not documented is marked [Inference] or [Unverified].

Page keys: [components] = code.claude.com/docs/en/plugins/components · [manifest] = /docs/en/plugins/manifest-reference · [code-intel] = /docs/en/plugins/code-intelligence · [loading] = /docs/en/plugins/loading · [troubleshooting] = /docs/en/plugins/troubleshooting · [tools] = /docs/en/tools-reference · [sub-agents] = /docs/en/sub-agents · [env-vars] = /docs/en/env-vars · [headless] = /docs/en/headless · [hooks-ref] = local copy at `~/.claude/projects/-Users-vasilsokolik-www-cc-sdd/eeaa2515-0295-4507-be6f-6f02d4c28078/tool-results/hooks-doc.md`. Full URLs in Sources.

## 1. Executive summary

- **One server per extension, first-registered wins.** "each file extension gets one server" and "when two enabled servers claim the same extension, the first registered handles those files and the other isn't used for them, whether the servers come from one plugin or two" [components]. The 6 notes are this rule working as designed, not a malfunction.
- **Exclusion is total, with no fallback.** Live experiment, 2026-10-06: `documentSymbol` on a `.json` routed to exactly one server — the error names `plugin:biome-lsp:biome` ("Method not found") — no fan-out, no second candidate; `documentSymbol` on a `.ts` returned 10 symbols from vtsls.
- **No per-capability split exists.** No documented field routes symbols to one server and diagnostics/lint to another for the same file; the conflict key is the extension string only. The only per-server behavior switch is the `diagnostics` toggle (default `true`) [manifest].
- **biome-lsp is not broken.** By the documented model it serves exactly the unclaimed extensions — `.json/.jsonc/.css` (pushes live-verified in the parent session); vtsls serves the six JS/TS extensions.
- **"First registered" across two different plugins is undocumented.** No ordering rule in any docs page, no ordering field in any on-disk registry. Empirically vtsls (installed 2026-01-09) registered before biome-lsp (installed 2026-10-05) and won all six overlaps. [Inference] that registration follows install/`enabledPlugins` order.
- **Diagnostics are push-on-edit**, summarized as "Found N new diagnostic issues in M files (ctrl+o to expand)" [code-intel]. [Inference] the push surface appears main-conversation-scoped: a subagent run received no pushes at all, even for a biome-owned control (conflict surfaced in §4).
- **No way to make two servers share an extension.** Documented levers: narrow one server's `extensionToLanguage`, disable a plugin, or same-name replacement within one plugin. Partition extensions; don't fight the order.
- **Subagents keep the LSP tool** — background subagents' built-in list includes `LSP`; "Before v2.1.280, background subagents couldn't use `LSP`." [sub-agents]. Whether LSP servers run in `-p`/headless mode is undocumented [Unverified].

## 2. Registration sources and order

### Sources that can register an LSP server

| Source                                     | Documented?            | Evidence                                                                                                                                                                     |
| ------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin `.lsp.json` at plugin root          | Yes                    | "Declare the server in `.lsp.json` at the plugin root" / "The file maps each server name directly to its configuration, with no wrapper object around the map." [components] |
| Manifest `lspServers` key                  | Yes                    | "`lspServers` takes a `.json` file path, an inline map of server name to config, or an array of either." "its servers add to the ones in `.lsp.json`" [manifest, components] |
| claude.ai-synced plugins                   | Yes (delivery channel) | "a synced plugin's skills, agents, hooks, MCP servers, and LSP servers all load, with the same trust as a marketplace plugin you installed." [loading]                       |
| `settings.json` (any scope)                | No — verified absent   | Zero occurrences of "lsp"/"language server" on the full Settings page (grep-verified during mining).                                                                         |
| Project-level `.lsp.json` outside a plugin | Not found              | [Unverified] whether such a mechanism exists.                                                                                                                                |

### Within one plugin

> "Claude Code loads `.lsp.json` at the plugin root first, then each declared config in order. A server name declared later replaces an earlier one." — [manifest]

> "When a manifest server has the same name as one in `.lsp.json`, the manifest server replaces it." — [components]

This is name-keyed replacement, not extension-keyed: the later declaration wins by server _name_, and the replaced server's extensions go with it.

### Across two distinct plugins — not documented

Neither [components], [code-intel], nor [loading] states which of two differently-named enabled plugins registers its servers first. The adjacent documented facts do not cover it: the loading reference's "Name conflicts" precedence (managed settings > `--plugin-dir` > installed marketplace > skills-directory > synced) decides _which plugin loads at all_ when manifest names collide, not server registration order; the "Official first" marketplace rule [code-intel] governs only the install-recommendation dialog.

### Empirical order evidence (live experiment, 2026-10-06)

Registry files, read-only:

- `~/.claude/plugins/installed_plugins.json` — keyed `name@marketplace`; key insertion order matches `installedAt` chronology. `vtsls@claude-code-lsps`: installed `2026-01-09T14:08:25.381Z` (4th key). `biome-lsp@sdd-local`: `2026-10-05T20:53:28.683Z`, `gitCommitSha: ed1b723…`, cache install path (last key).
- `~/.claude/settings.json` → `enabledPlugins` — same insertion order (vtsls 4th, biome-lsp 10th and last).
- `~/.claude/plugins/data/<plugin>/` state dirs — both empty; no persisted LSP registration state.
- No priority/order/weight field exists anywhere in the `lspServers` schema [manifest] or any registry file.

Outcome: vtsls won all six overlapping extensions; biome kept its exclusive `.json/.jsonc/.css`. [Inference] the mechanism is registration following `enabledPlugins`/`installed_plugins.json` key order or `installedAt` — only the outcome was observed, not the registration step. Do not generalize from one observation.

Lifecycle note: "The language server starts the first time Claude edits a file with one of the plugin's extensions." [code-intel]

## 3. Conflict resolution: per-extension, not per-capability

### The documented rule

> "Your plugin configures the connection but doesn't install the server binary, and **each file extension gets one server**"
> "**Extension conflicts**: when two enabled servers claim the same extension, the first registered handles those files and the other isn't used for them, whether the servers come from one plugin or two. The `/plugin` **Errors** tab shows the warning `LSP server "<name>" is not used for <ext> files`" — [components]

The documented template matches the six notes; the appended runtime clause "— plugin \"vtsls\" already registered a server for that extension" is not in the docs [Unverified] (live-observed wording). There is no per-capability concept anywhere in the docs: no field routes symbols to one server and diagnostics to another for the same file. [Inference] all LSP-tool operations for a file go to the single owning extension server; [tools] describes no server selection.

### The live experiment (decisive routing evidence)

Live experiment, 2026-10-06:

- `documentSymbol` on a repo `.ts` file returned 10 symbols (vtsls/tsserver serving `.ts`).
- `documentSymbol` on a `.json` probe returned the exact error:

```
Error performing documentSymbol: LSP request 'textDocument/documentSymbol' failed for server 'plugin:biome-lsp:biome': Method not found
```

Two facts follow: (1) the `.json` file routes to exactly one server, identified namespaced as `plugin:<plugin-name>:<server-name>`; (2) the request was not fanned out and did not fall back to another server when the owner lacked the method. biome's `lsp-proxy` per this repo's README offers diagnostics/format/code actions, no symbols/hover — consistent with the error.

### The `.ts` diagnostics probe — negative, with a caveat

Live experiment, 2026-10-06: a `.ts` probe seeded with biome-flaggable violations (unused import, unsorted interface members) and a tsserver-flaggable one (unused local) produced **no** diagnostics of any attribution within ~20s — so no `(biome)`-attributed diagnostic flowed for the "lost" extension. This is consistent with biome's exclusion from `.ts`, but the same run's biome-owned `.json` control was also silent (§4), so this one session cannot separate "excluded" from "pushes don't reach subagents." The routing verdict rests on the LSP-tool result above plus the parent session's live verification (biome pushes on `.json`/`.css`; vtsls serving `.ts`).

**Follow-up on a real file (vitest.config.ts, main conversation, live 2026-10-06):** an edit seeding unsorted object keys produced a pushed `[2307] Cannot find module 'vitest/config'` **(ts)** diagnostic, while `biome check` on the same file version flags it (`lint/correctness/noUndeclaredDependencies`) — and no `(biome)` push arrived. With the pushes demonstrably flowing to the main conversation in that same session (§4), exclusivity is confirmed on real content, not just probes.

## 4. Diagnostics routing and capability gaps

Push model, edit-triggered:

> "**Diagnostics after edits**: each time Claude edits or writes a file the server handles, Claude gets the errors and warnings the server reports." — [code-intel]

Delivery shape: "the conversation shows only the `Found N new diagnostic issues in M files (ctrl+o to expand)` summary… To read the issues themselves, press **Ctrl+O**." [code-intel] Per-server opt-out: `diagnostics` — "Whether to push diagnostics into context after edits. Defaults to `true`" [manifest]. The `<new-diagnostics>` tag itself appears in no fetched docs page nor [hooks-ref]. [Not found in docs]

**Surfaced conflict between observations (both reported as made; not silently reconciled):**

- Parent session, live-verified 2026-10-05: an unsorted-keys `.json` write produced `<new-diagnostics>` `[assist/source/useSortedKeys]` (biome); a duplicate-property `.css` produced `[lint/suspicious/noDuplicateProperties]` (biome).
- Live experiment, 2026-10-06 (subagent session): a biome-owned `.json` control produced no `<new-diagnostics>` in ~50s across 7 tool results, and the `.ts` probe none in ~20s — while a biome CLI run on the same control proved the rule fires (`lsp-probe-ctrl.json:1:1 assist/source/useSortedKeys`).
- [Inference, based on observed patterns]: the push surface appears to be a main-conversation feature that did not reach the subagent context in that run — or it simply did not trigger. No docs page states where pushes surface; the reconciling mechanism is undocumented [Unverified].
- **Corroboration (main conversation, live 2026-10-06):** during that same subagent run, the main conversation received `<new-diagnostics>` for the subagent-written probes — `lsp-probe-ctrl.json` `[assist/source/useSortedKeys]` (biome), `lsp-probe-ts.ts` ×2 `[6133]` (ts), `lsp-probe-sym.json` (biome). The pushes were not lost: they surfaced in the main conversation while the editing subagent itself saw none. [Inference] the push surface is the main conversation regardless of which agent edited the file — which also resolves the §3 caveat: the subagent-run silences were a surfacing artifact, not exclusion, and the `.ts` "no biome push" verdict stands via the real-file follow-up above.

LSP tool on a capability gap: the documented failure mode covers only start failure — "Claude Code returns an error result for each LSP call on a file whose language server it can't start." [tools] For a _running_ server that lacks a method, the docs say nothing; the live evidence is the `Method not found` error above. [Inference] with exactly one candidate server per extension, a missing capability yields an error (or empty) result — no second candidate exists by construction. Server-side misconfiguration is out of scope for CC: "A language server that isn't configured for the workspace can report unresolved imports for internal packages. There's nothing to fix on the Claude Code side…" [troubleshooting]

## 5. Subagents and -p mode

- Tool pools [sub-agents]: "a background subagent keeps every MCP tool but only these built-in tools: `Read`, `Grep`, `Glob`, `LSP`, `Bash`, …"; "Before v2.1.280, background subagents couldn't use `LSP`." Foreground subagents inherit the main pool narrowed by their frontmatter filter; forks receive the exact main pool.
- Server process sharing between main conversation and subagents: [Not found in docs]. [Inference, based on observed patterns] tools are inherited and servers start per session by edit events, which reads as one shared server set per session — not stated anywhere.
- Cloud sessions: "Claude Code doesn't start plugin language servers, so Claude gets no diagnostics or code navigation there." [code-intel]
- `-p`/headless: the [headless] page contains zero LSP/language-server mention; the errors reference likewise. [Unverified] whether plugin LSP servers start in print mode.
- Operational facts: `CLAUDE_CODE_SAFE_MODE=1` — LSP servers "do not load" [env-vars]; Linux memory cgroup captable kind `lsp` [env-vars, tools]; after plugin updates "LSP servers keep using the previous version's path. Run `/reload-plugins` to switch" [loading]; a reload whose cache guard prints `This reload adds the LSP tool` / `This reload removes the LSP tool` needs `--force` [troubleshooting]. `${CLAUDE_PROJECT_DIR}` is also set in plugin LSP servers' environment [hooks-ref, line 181].

## 6. Comparison with IDE multi-server models

[Not found in docs] — none of the pages read (components, manifest, code-intel, tools, sub-agents, troubleshooting, loading, cli-reference, headless, errors, env-vars, large-codebases, hooks reference) mentions Zed, Neovim, VS Code, or any other editor's multi-server handling; per mining discipline this is not filled from memory. [Inference] CC's model is exclusive-per-extension, decided once at registration, unlike the typical IDE selector/composition model where several servers co-run on one file type and the client merges capabilities (semantics from one, lint/format from another). In CC the equivalent split must be authored as an extension partition at config time; losers exist only as Errors-tab notes.

## 7. Practical guidance for this repo (vtsls + biome-lsp)

- **Keep the current shape.** vtsls owns the six JS/TS extensions (`.ts` symbols verified live); biome-lsp owns `.json/.jsonc/.css` (pushes verified in the parent session). This is the documented model working — nothing is partially broken.
- **Do not try to make both serve `.ts`.** No documented mechanism exists, and which server wins cross-plugin has no documented control [Unverified]. Partition extensions instead of fighting an unobservable order.
- **To silence the 6 notes:** narrow biome-lsp's `extensionToLanguage` to `.json/.jsonc/.css`, dropping the six overlapping keys. Tradeoff: the claim is gone outright — if vtsls is later removed or disabled, biome will not pick the JS/TS extensions back up until the map is widened again. (biome's lsp-proxy never offered symbols/hover, so its `.ts` value here was diagnostics-only.)
- **Blunter alternative:** `/plugin disable` one of the two where the overlap annoys; enable/disable across six settings sources is documented [loading].
- **`diagnostics: false`** is the only per-server knob, if biome's JSON/CSS pushes ever become noise [manifest].
- **Config hygiene:** `claude plugin validate` doesn't read `.lsp.json`; one invalid entry skips the whole file (`Invalid LSP server config for ".lsp.json"` in the Errors tab) [components]. `command` starts from PATH — the plugin's absolute `/opt/homebrew/bin/biome` sidesteps the `Executable not found in $PATH` failure [components, troubleshooting]. Keep server logs on stderr, never stdout [components].

## 8. Open questions

- The cross-plugin registration-order rule — no doc, no registry field; one observation only. [Unverified]
- Stability/officialness of the Errors-tab clause "already registered a server for that extension" (not in docs). [Unverified]
- Whether `<new-diagnostics>` ever surfaces inside subagent contexts: negatively observed once, while the same run's pushes landed in the main conversation (§4 corroboration) — main-conversation surfacing of cross-agent edits is positively established. [Unverified]
- LSP-tool behavior on capability gaps beyond the one observed `Method not found` (hover, formatting, other operations). [Unverified]
- Whether plugin LSP servers start in `-p`/headless mode. [Unverified]
- Whether main conversation and subagents share language-server processes. [Unverified]
- Whether CC will ever support per-capability composition or multi-server-per-extension. [Unverified] — docs as of 2026-10-06 document only first-registered-wins.

## Sources

- https://code.claude.com/docs/en/plugins/components (§LSP servers — the conflict rule; the 2026-10-05 parent-session quote re-verified verbatim 2026-10-06)
- https://code.claude.com/docs/en/plugins/manifest-reference (§lspServers — full field table, load order)
- https://code.claude.com/docs/en/plugins/code-intelligence
- https://code.claude.com/docs/en/plugins/loading
- https://code.claude.com/docs/en/plugins/troubleshooting
- https://code.claude.com/docs/en/plugins/cli-reference (§/reload-plugins)
- https://code.claude.com/docs/en/tools-reference (§LSP tool behavior)
- https://code.claude.com/docs/en/sub-agents (§Available tools)
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/headless (checked: no LSP content)
- https://code.claude.com/docs/en/errors (checked: no LSP content)
- https://code.claude.com/docs/en/settings (grep-verified: no LSP content)
- https://code.claude.com/docs/en/large-codebases (no conflict/routing content)
- Local: [hooks-ref] path above (line 181: `${CLAUDE_PROJECT_DIR}` set for plugin LSP servers)

Method notes: one mining pass used the web-reader MCP tool; the second hit persistent 500s and fetched the same pages via the docs site's official `.md` endpoints (curl). URL moves confirmed 2026-10-06: code-intelligence lives at `/docs/en/plugins/code-intelligence` (old `/docs/en/code-intelligence` 404s); manifest-reference at `/docs/en/plugins/manifest-reference` (old `/docs/en/plugins/reference` 404s). Live experiments ran in a subagent session with both plugins enabled, biome CLI 2.5.15, repo `biome.json` with assist actions on; all `lsp-probe-*` scratch files deleted and verified gone.
