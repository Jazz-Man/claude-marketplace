---
name: init
description: Write the user-owned .claude/rules/sdd.md workflow-rules file from the plugin's default workflow map (single source of truth - no second copy anywhere). Refuses politely when the file exists and offers a read-only diff instead of overwriting. User-invoked.
disable-model-invocation: true
---

# init - write the user's sdd rules file

## Role

You run INLINE in the main conversation. This skill has exactly one effect:
creating `<project>/.claude/rules/sdd.md` containing the sdd workflow rules,
taken verbatim from the plugin's default workflow map. The user's file then
takes precedence over the plugin default (spec 4.3): once it exists, the
SessionStart hook stays silent and never injects the default map again - even
if the file lags behind a newer plugin version. Precedence is by design.

The plugin default lives at `${CLAUDE_PLUGIN_ROOT}/assets/workflow-map.md`.
It is the single source of truth: do not restate its content here, do not
write it from memory, and never write anything but the stripped map into
`.claude/rules/sdd.md` - no session briefing, no narrative, no appended
content from any other skill, ever.

## Hard rules

1. Bash is limited to read-only file inspection (`cat`, `sed`, `diff`, `ls`).
2. **AskUserQuestion, always.** Explanation in chat prose first, then the
   structured question (recommended option first, labeled).
3. **Never overwrite silently.** An existing `.claude/rules/sdd.md` is
   authoritative and user-owned, possibly hand-customized.

## The rules content (strip command)

The rules file is the default map minus its hook-injection wrappers: the
`<SUBAGENT-STOP>` notice line, the `<EXTREMELY_IMPORTANT>` /
`</EXTREMELY_IMPORTANT>` fence lines, and any leading blank lines, so the
output starts at the `# sdd` heading. Print it read-only:

```bash
sed -e '/^<SUBAGENT-STOP>/d' -e '/^<EXTREMELY_IMPORTANT>$/d' -e '/^<\/EXTREMELY_IMPORTANT>$/d' \
    "${CLAUDE_PLUGIN_ROOT:?unset}/assets/workflow-map.md" | sed '/./,$!d'
```

Every later step reuses this same pipeline.

## Step 1 - Check for an existing file

Check whether `<project>/.claude/rules/sdd.md` exists (`ls` or Read).

- **Absent** -> continue to Step 3 and write it.
- **Exists** -> Step 2. Do not modify the file in this step.

## Step 2 - Refuse politely, offer the diff

Explain in prose: the file exists, it is user-owned, and it takes precedence
over the plugin default; the plugin does not replace it. Then ONE
AskUserQuestion with these options:

1. **Show the diff** (recommended) - read-only comparison against the current
   plugin default:

   ```bash
   diff .claude/rules/sdd.md \
       <(sed -e '/^<SUBAGENT-STOP>/d' -e '/^<EXTREMELY_IMPORTANT>$/d' -e '/^<\/EXTREMELY_IMPORTANT>$/d' \
             "${CLAUDE_PLUGIN_ROOT:?unset}/assets/workflow-map.md" | sed '/./,$!d')
   ```

   Show the diff output, note in prose what differs, and end by asking (via
   AskUserQuestion) whether to overwrite with the default, keep the file as
   is, or let the user hand-edit first. The user hand-edits or asks for the
   overwrite - you never merge or selectively edit the file yourself.

2. **Overwrite with the plugin default** - only on this explicit instruction:
   run Step 3 as if the file were absent.
3. **Keep the file as is** - end the skill.

## Step 3 - Write the file

1. Run the strip command from **The rules content** above.
2. Write `<project>/.claude/rules/sdd.md` with EXACTLY that output - verbatim,
   byte for byte: no rewording, reordering, reflowing, or trimming.
3. Nothing else goes into the file, now or later.

## Step 4 - Confirm in chat

ONE short message, nothing persisted beyond the file itself: the rules file
now exists at `<project>/.claude/rules/sdd.md` and governs the sdd workflow
(the SessionStart injection of the default map no longer applies). Name the
entry command in a code block:

```
/sdd:discovery
```
