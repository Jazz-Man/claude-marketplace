// AST adversarial fixtures: literal Bash payloads ported from the bench
// equivalence corpus (bench/equiv.ts ADVERSARIAL). Each row pins that the
// fused walk survives the shape — parseCommand returns non-null and surfaces
// at least minUnits units — so an unbash upgrade cannot silently drop commands.

export interface AdversarialCommand {
  command: string;
  minUnits: number;
}

export const ADVERSARIAL: AdversarialCommand[] = [
  { command: "env FOO=1 python -c 'print(1)'", minUnits: 1 },
  { command: "FOO=bar npm install", minUnits: 1 },
  { command: "export ARR=(1 2)", minUnits: 1 },
  { command: "env A[0]=x cmd arg", minUnits: 1 },
  { command: "diff <(ls) <(ls -a)", minUnits: 3 },
  { command: "echo a<(ls)b", minUnits: 2 },
  { command: "cat <<EOF > f\nhi\nEOF", minUnits: 1 },
  { command: "echo $(cat <<EOF\nhi\nEOF)", minUnits: 2 },
  { command: "for f in 1 2; do echo $f; done", minUnits: 1 },
  { command: "case x in a) echo;; esac", minUnits: 1 },
  { command: "while read l; do echo $l; done", minUnits: 2 },
  { command: "if true; then x; fi", minUnits: 2 },
  { command: "f() { echo hi; }", minUnits: 1 },
  { command: "a=1; b=2 cmd", minUnits: 1 },
  { command: "> f echo hi", minUnits: 1 },
  { command: "cmd <<< str", minUnits: 1 },
  { command: "echo hi >&2", minUnits: 1 },
  { command: "2>&1 cmd", minUnits: 1 },
  { command: "x=$(y)", minUnits: 1 },
  { command: "echo `date`", minUnits: 2 },
  { command: "echo $(date)", minUnits: 2 },
  { command: "time ls", minUnits: 1 },
  { command: "! ls", minUnits: 1 },
  { command: "seq 1 10 | head -1", minUnits: 2 },
  { command: "echo a{1,2}b", minUnits: 1 },
  { command: "make *", minUnits: 1 },
  { command: "echo [a-z]*.ts", minUnits: 1 },
  { command: "v=${x:-default}", minUnits: 0 },
  { command: "echo ${x}; echo ${#x}", minUnits: 2 },
  { command: "x=$((1 + 2))", minUnits: 0 },
  { command: "echo $((1 + 2))", minUnits: 1 },
  { command: "tee >(gzip > f.gz)", minUnits: 2 },
  { command: "exec 3< f", minUnits: 1 },
  { command: "echo 'single' \"double\" $'ansi'", minUnits: 1 },
  { command: "arr[1]=x cmd", minUnits: 1 },
  { command: "watch -n1 'ls -la'", minUnits: 1 },
  { command: "env -i HOME=/tmp sh -c 'echo hi'", minUnits: 1 },
];
