import { describe, expect, it } from "bun:test";

import { parseCommand } from "../src/core/ast.ts";

describe("parseCommand", () => {
  it("walks best-effort ASTs from malformed input (unbash never throws)", () => {
    expect(parseCommand('cat "')?.words).toContain("cat");
  });

  it.each([
    [
      "collects units across && and pipelines",
      "cd /tmp && git push",
      [
        { args: ["/tmp"], name: "cd" },
        { args: ["push"], name: "git" },
      ],
    ],
    [
      "collects units across newline separators",
      "git add .\ngit push",
      [
        { args: ["add", "."], name: "git" },
        { args: ["push"], name: "git" },
      ],
    ],
    [
      "keeps the command name under an env-prefix assignment",
      "FOO=1 git push origin",
      [{ args: ["push", "origin"], name: "git" }],
    ],
    [
      "collects units from nested substitution scripts (deduped, raw text out of args)",
      "echo $(git push)",
      [
        { args: [], name: "echo" },
        { args: ["push"], name: "git" },
      ],
    ],
  ])("%s", (_, command, units) => {
    expect(parseCommand(command)?.units).toEqual(units);
  });

  it("drops only WHOLE-WORD substitutions from args; spliced ones ride for the fail-closed gate", () => {
    expect(
      parseCommand('echo "pre $(git push) post" `cat x`')?.units[0]?.args,
    ).toEqual(["pre $(git push) post"]);
  });

  it("keeps plain variable args intact (fail-closed gate depends on them)", () => {
    expect(parseCommand("cat $HOME/foo ${HOME}/bar")?.units[0]?.args).toEqual([
      "$HOME/foo",
      "${HOME}/bar",
    ]);
  });
});

describe("parseCommand (redirects, words, functionDefs)", () => {
  it("keeps redirect targets out of unit args but records them", () => {
    const parsed = parseCommand("git log > $(mktemp)");
    expect(parsed?.units.map((unit) => unit.name)).toEqual(["git", "mktemp"]);
    expect(parsed?.units[0]?.args).toEqual(["log"]);
    expect(parsed?.redirects).toEqual([
      {
        operator: ">",
        target: "$(mktemp)",
      },
    ]);
  });

  it.each([
    [
      "keeps equal-valued distinct commands (substitution + real command)",
      "FOO=$(git status) git status",
    ],
    [
      "keeps repeated identical sibling commands as two units (identity, not value)",
      "git status && git status",
    ],
  ])("%s", (_, command) => {
    expect(parseCommand(command)?.units).toHaveLength(2);
  });

  it("keeps quoted args as single values", () => {
    expect(parseCommand("git commit -m 'a b'")?.units[0]?.args).toEqual([
      "commit",
      "-m",
      "a b",
    ]);
  });

  it("flat words include quoted-literal fragments", () => {
    expect(parseCommand('cat "/et"c/passwd')?.words).toContain("/et");
  });

  it("flat words include arithmetic substitution scripts", () => {
    expect(parseCommand("(( $(cat /etc/passwd) ))")?.words).toContain(
      "/etc/passwd",
    );
  });

  it("collects inline function definition names (every form)", () => {
    expect(parseCommand("function fb { fb | fb & }; fb")?.functionDefs).toEqual(
      ["fb"],
    );
    expect(parseCommand("a(){ b& }; b(){ a& }; a")?.functionDefs).toEqual([
      "a",
      "b",
    ]);
    expect(parseCommand("ls -la")?.functionDefs).toEqual([]);
  });
});

describe("parseCommand (walk pins)", () => {
  it("truncates past the nesting limit — buried commands stay invisible (accepted fail-open)", () => {
    const deep = `${"( ".repeat(257)}bash -c 'echo hi'${" )".repeat(257)}`;

    const parsed = parseCommand(deep);

    expect(parsed).not.toBeNull();
    expect(parsed?.units.some((unit) => unit.name === "bash")).toBe(false);
  });

  it("rides the heredoc delimiter in unit args AND the redirects view (heredoc-fed detection couples them)", () => {
    const parsed = parseCommand("bash <<EOF\nls\nEOF");

    expect(parsed?.units[0]).toEqual({
      args: ["EOF"],
      name: "bash",
    });
    expect(parsed?.redirects).toEqual([
      {
        operator: "<<",
        target: "EOF",
      },
    ]);
    expect(parseCommand("bash <<'EOF'\nls\nEOF")?.units[0]?.args).toEqual([
      "EOF",
    ]);
  });

  it("keeps unquoted heredoc bodies visible to the walk", () => {
    const parsed = parseCommand("cat <<EOF\nhello $(whoami)\nEOF");
    expect(parsed?.units.map((unit) => unit.name)).toEqual(["cat", "whoami"]);
    expect(parsed?.words).toContain("hello ");
  });

  it("keeps quoted-delimiter heredoc bodies invisible (owned by no-inline-scripts)", () => {
    const parsed = parseCommand("bash <<'EOF'\nrm -rf /\nEOF");
    expect(parsed?.units).toHaveLength(1);
    expect(parsed?.words).not.toContain("rm");
  });
});

describe("parseCommand (walk pins — globs, substitutions, elif)", () => {
  it("splits unquoted globs into fragment words while args keep the full value", () => {
    expect(parseCommand("ls [a-z].txt")?.units[0]?.args).toEqual(["[a-z].txt"]);
    expect(parseCommand("ls [a-z].txt")?.words).toContain("a-z");
    expect(parseCommand("x=*")?.words).toContain("*");
    expect(parseCommand("ls --filter=[$(cmd)]")?.units[0]?.args).toEqual([
      "--filter=[$(cmd)]",
    ]);
    expect(
      parseCommand("ls --filter=[$(cmd)]")?.units.map((unit) => unit.name),
    ).toEqual(["ls", "cmd"]);
    expect(parseCommand(String.raw`ls \*`)?.units[0]?.args).toEqual(["*"]);
  });

  it("keeps spliced substitutions riding args for the fail-closed gate", () => {
    expect(parseCommand("cat /etc/pass$(echo wd)")?.units[0]?.args).toEqual([
      "/etc/pass$(echo wd)",
    ]);
  });

  it("walks elif branches", () => {
    expect(
      parseCommand("if true; then echo a; elif false; then echo b; fi")?.units,
    ).toEqual([
      {
        args: [],
        name: "true",
      },
      {
        args: ["a"],
        name: "echo",
      },
      {
        args: [],
        name: "false",
      },
      {
        args: ["b"],
        name: "echo",
      },
    ]);
  });
});
