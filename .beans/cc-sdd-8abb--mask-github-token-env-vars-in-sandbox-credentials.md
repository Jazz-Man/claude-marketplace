---
# cc-sdd-8abb
title: Mask GitHub token env vars in sandbox credentials
status: completed
type: task
priority: normal
created_at: 2026-11-23T15:08:48Z
updated_at: 2026-11-23T15:45:03Z
---

Switch the sandbox credential env vars from deny to mask so service CLIs (gh first) authenticate from sandboxed commands without holding the real token. Requires network.tlsTerminate and injectHosts that the domain allowlist admits. Reproduced: in the sandbox gh auth status fails with HTTP 401 because GH_TOKEN/GITHUB_TOKEN are unset and the stored login is rejected.

## Notes

- Generator state (`lists/credential-env-vars.ts`, `config.ts`): 20 variables masked with per-service `injectHosts` (GitHub.com, OpenAI, Hugging Face, Anthropic, Google AI, Ollama, Context7, Z.AI, npm, crates.io, RubyGems, Sentry, Snyk — hosts from general knowledge, only GitHub exercised); 25 stay `deny` (15 non-credentials and 10 tokens without a known public host or not carried in a plain HTTP request); `network.tlsTerminate: {}`. All 45 names preserved; output outside `sandbox.credentials.envVars` and `sandbox.network` unchanged. `bun check --strict --all` and `biome check` clean. The owner regenerated from the first version (4 masks); the 20-mask version is not live yet.
- Live check in the running session: mask is active (`GITHUB_TOKEN` is a 47-character placeholder; `GH_TOKEN` is absent from Claude Code's environment), but `gh auth status` still returns 401. curl inside the sandbox sees the real Sectigo-issued `*.github.com` certificate, so this session's proxy is not terminating TLS although `tlsTerminate: {}` is in the user settings — the placeholder reaches GitHub unchanged, the failure mode `docs/claude/sandboxing.md:445` describes.
- Not decided from inside this session: whether the proxy only takes its "ephemeral certificate authority for the session" at session start (this session predates the setting) or TLS termination is unavailable in this install (`/doctor` warning `TLS termination is unavailable`). CLI `claude doctor` prints no sandbox/TLS lines. Needs a session started after the regeneration.
- Before the change, in the sandbox `gh` used its stored login and GitHub rejected that token too (401); `~/.config/gh/hosts.yml` holds no `oauth_token`.

## Validation

Verified in a session with the live config (`tlsTerminate: {}`, `allowedDomains: ["*.github.com", "registry.npmjs.org"]`, 20 masked variables): the sandbox proxy terminates TLS (curl sees `CN=sandbox-runtime ephemeral CA`), the CA reaches sandboxed commands through `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`, `CURL_CA_BUNDLE`, `REQUESTS_CA_BUNDLE`, `GIT_SSL_CAINFO`, `CARGO_HTTP_CAINFO`, `DENO_CERT`; `GITHUB_TOKEN` is a 47-character placeholder in the shell; `gh auth status` reports `Logged in to github.com account Jazz-Man (GITHUB_TOKEN)`, `gh api user` returns the login, and curl with the placeholder gets 200. curl, git over HTTPS, bun and python3 still verify TLS against GitHub and npm hosts.

An earlier check in the same session, right after the first regeneration, still saw the real Sectigo certificate and got 401 — termination was not active then. Which later change activated it (the second regeneration or adding `allowedDomains`) was not isolated.

Left as is: gh's stored login (not the env token) is rejected by GitHub (`The token in default is invalid`), independent of the sandbox and present before the change; `GH_TOKEN` is absent from Claude Code's environment, only `GITHUB_TOKEN` is masked. Hosts for the 16 non-GitHub masked services are unverified.
