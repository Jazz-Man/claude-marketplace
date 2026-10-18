# Review Package — Task 1.2, Round 1

- Task: 1.2 (bean cc-sdd-qhkg) — Re-point the marketplace manifest and validate green
- Requirements: 1.3, 2.1, 2.3 (per the task bean's _Requirements_ line)
- Scope: /Users/vasilsokolik/www/cc-sdd/.claude-plugin/marketplace.json — the root marketplace manifest ONLY
- Baseline note: working tree was clean at commit f86d1c3 (the task-1.1 move commit) before this task; the manifest edit is a plain file edit by the implementer; the user commits at the stop point (agents never write git)
- Change: exactly one line — entry `source`: `"./"` → `"./plugins/sdd"`; marketplace name, owner, entry name, descriptions byte-identical
- Implementer's evidence: `claude plugin validate .` exit 0, zero errors/warnings/notes (--json success:true), output names the root manifest; `"source": "./plugins/sdd"` present (line 8); plugins/sdd/.claude-plugin/plugin.json exists with name "sdd" (entry-name match, design postcondition)
- Binding context from task 1.1 (bean cc-sdd-594v ## Notes): validate stays GREEN even with a stale source — validate color is NOT the gate; the content of the source line and the entry-name/postcondition checks are
- RED_EVIDENCE: pre-edit grep showed `"source": "./"` (content-gate failing state as RED proxy; no test framework exists)

## Diff (working tree vs HEAD)

.claude-plugin/marketplace.json
@@ -5,7 +5,7 @@
"plugins": [
{
"name": "sdd",

-      "source": "./",

*      "source": "./plugins/sdd",
       "description": "Kiro-style spec-driven development for Claude Code with subagent-first execution"
  }
  ]
