// no-inline-scripts-policy command fixtures: every table line is a literal
// Bash payload the policy must judge. Lint/assist are off for this folder —
// the Fibonacci fixture contains ${}-shaped template text on purpose.

export const DENY: string[] = [
  "bun -e 'console.log(1)'",
  "bun -e '\n  let a = 0n, b = 1n;\n  for (let i = 0; i < 100; i++) { const nx = a + b; a = b; b = nx; if (i === 78 || i === 99) console.log(`F(${i+1}) = ${a}`); }\n  console.log(\"MAX_SAFE =\", Number.MAX_SAFE_INTEGER);'",
  "bun --eval 'console.log(1)'",
  "node -e 'console.log(1)'",
  "node --eval 'console.log(1)'",
  "node -p '1 + 1'",
  "node --print '1 + 1'",
  "python -c 'print(1)'",
  "python3 -c 'print(1)'",
  "python -uc 'print(1)'",
  "ruby -e 'puts 1'",
  "perl -e 'print 1'",
  "perl -E 'say 1'",
  "php -r 'echo 1;'",
  "deno eval 'console.log(1)'",
  "osascript -e 'display notification \"hi\"'",
  "bash -c 'echo hi'",
  "bash -ic 'echo hi'",
  "sh -c 'echo hi'",
  "zsh -c 'echo hi'",
  "eval 'echo hi'",
  "env python -c 'print(1)'",
  "sudo bash -c 'echo hi'",
  "FOO=1 python -c 'print(1)'",
  "cd tmp && python -c 'print(1)'",
  "echo $(python -c 'print(1)')",
  "echo 'print(1)' | python",
  "echo 'console.log(1)' | node",
  "cat script.sh | bash",
  "python -",
  "node -",
  "python - <<'EOF'\nprint(1)\nEOF",
  // heredoc/here-string-fed interpreters: the fed body IS the inline
  // script — the Redirect records collected by ast.ts must deny it exactly
  // like the piped/stdin forms. Payloads are DATA here; nothing executes.
  "bash <<EOF\necho hi\nEOF",
  "python3 <<'EOF'\nprint(1)\nEOF",
  // wrapper-prefixed heredoc: the interpreter hides behind the wrapper
  "env bash <<EOF\necho hi\nEOF",
  "nice -n 5 python3 <<'EOF'\nprint(1)\nEOF",
  // here-string on an interpreter is inline code, same family as heredoc
  "python3 <<< 'print(1)'",
  "find . -type f | xargs sh -c 'echo $0'",
  // versioned interpreter names
  "python3.13 -c 'print(1)'",
  "python3.12 -c 'print(1)'",
  "node20 -e 'console.log(1)'",
  "perl5.34 -e 'print 1'",
  "ruby3.2 -e 'puts 1'",
  "env python3.13 -c 'print(1)'",
  "fish -c 'echo hi'",
  // bare interpreters read a piped/heredoc script (or open a REPL) — no args
  "bun",
  "node",
];

export const ALLOW: string[] = [
  "sed 's/a/b/' file.txt",
  "awk '{print $1}' file.txt",
  "sort -c file.txt",
  "head -c 100 file.txt",
  "tail -c 50 file.txt",
  "cut -c 1-5 file.txt",
  "node --version",
  "python3 --version",
  "python3 tmp/fib.py",
  "python -u tmp/fib.py",
  "python -m venv .venv",
  "bun tmp/fib.ts",
  "bun run build",
  "bun test",
  "bash plugins/sdd/helper-tests.sh",
  "sh generate.sh",
  'echo "use python -c carefully"',
  "man bash",
  "git status",
  "python3.13 --version",
  "node22 --version",
  // non-interpreter heredoc/here-string consumers stay allowed: only
  // interpreter-adjacent feeds carry inline code
  "cat <<EOF\nhello\nEOF",
  "cat <<< hello",
];

export const FUNCTIONS: string[] = [
  ":(){ :|:& };:",
  "_(){ _|_& };_",
  "bomb(){ bomb | bomb & }; bomb",
  "function fb { fb | fb & }; fb",
  "a(){ b& }; b(){ a& }; a",
  // benign inline use is denied BY DESIGN: an inline function is always
  // the wrong shape for an agent Bash call
  'usage(){ echo "usage: foo" | less & }; usage',
];
