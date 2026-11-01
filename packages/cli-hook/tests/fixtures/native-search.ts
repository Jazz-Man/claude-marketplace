// native-search policy fixtures: bash grep/find are banned in favor of the
// built-in Grep/Glob tools; rg stays allowed as the CLI fallback.

export const DENY: string[] = [
  "grep pattern src/",
  "grep -rn pattern .",
  "egrep pattern file",
  "fgrep pattern file",
  "find . -name '*.ts'",
  "find /workspace -type f",
  "cat x | grep y",
  "ps aux | grep node",
  "GREP pattern file",
  "Find .",
  "time grep pattern .",
  "xargs grep pattern",
  "grep 'git push' log",
  "grep -c pattern file.txt",
  "find ~ -name x",
  "env grep pattern .",
  "nice -n 5 grep pattern",
  "nohup find . -name x",
  "timeout 10 grep pattern src/",
  "parallel grep pattern ::: files",
  "sudo grep pattern /etc/passwd",
  "xargs -I {} grep pattern",
  "xargs -d '\\n' grep pattern",
  "echo grep",
];

export const ALLOW: string[] = [
  "rg pattern src/",
  "rg -t ts pattern",
  "cat file",
  "ls -la",
];
