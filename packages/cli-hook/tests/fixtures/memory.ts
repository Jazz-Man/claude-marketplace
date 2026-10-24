// Memory-policy fixtures: literal Bash payloads judged by the shared
// filesystem engine; the memory tree lives under the always-allowed $HOME
// zone, so every mutating row here would pass silently without the policy.

export const MEMORY_ASK: string[] = [
  "echo x > ~/.claude/projects/-p/memory/n.md",
  "echo x >> ~/.claude/projects/-p/memory/n.md",
  "rm ~/.claude/projects/-p/memory/n.md",
  "rm ~/.claude/projects/-p/memory/stray.bin",
  "mv f ~/.claude/projects/-p/memory/n.md",
  "cp ~/www/repo/f.md ~/.claude/projects/-p/memory/n.md",
  "cp f.txt ~/.claude/projects/-p/memory/f.txt",
  "tee ~/.claude/projects/-p/memory/n.md",
  "touch ~/.claude/projects/-p/memory/n.md",
  "mkdir -p ~/.claude/projects/-p/memory/sub",
  "unknowntool ~/.claude/projects/-p/memory/f.md",
  "sed -i 's/a/b/' ~/.claude/projects/-p/memory/f.md",
  "perl -pi -e 's/a/b/' ~/.claude/projects/-p/memory/f.md",
  "find ~/.claude/projects/-p/memory -name '*.md' -delete",
];

export const MEMORY_ALLOW: string[] = [
  "cat ~/.claude/projects/-p/memory/n.md",
  "grep x ~/.claude/projects/-p/memory/n.md",
  "ls ~/.claude/projects/-p/memory",
  "cat ~/.claude/projects/-p/transcripts/t.jsonl",
  "tee ~/www/repo/build/x",
  "sed 's/a/b/' ~/.claude/projects/-p/memory/f.md",
  "find ~/.claude/projects/-p/memory -name '*.md'",
];
