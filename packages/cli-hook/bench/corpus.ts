import commandList from "../src/mutable-commands.txt";

export const EXEMPLARS: Record<string, string> = {
  "deno run <url>": "deno run https://example.com/x.ts",
  "go run <pkg>@<version>": "go run example.com/pkg@latest",
};

export const commands: string[] = commandList
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "")
  .map((line) => EXEMPLARS[line] ?? line);
