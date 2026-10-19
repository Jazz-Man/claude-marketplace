const MAIN = `${import.meta.dir}/../../src/main.ts`;

export const bashPayload = (command: string) => ({
  cwd: "/proj",
  hook_event_name: "PreToolUse",
  tool_input: { command },
  tool_name: "Bash",
});

export const filePayload = (tool_name: string, filePath: string) => ({
  cwd: "/proj",
  hook_event_name: "PreToolUse",
  tool_input: { file_path: filePath },
  tool_name,
});

export async function spawnHook(raw: string) {
  const proc = Bun.spawn(["bun", MAIN], {
    env: {
      ...Bun.env,
      CLAUDE_PROJECT_DIR: "/proj",
    },
    stderr: "pipe",
    stdin: new Blob([raw]),
    stdout: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { code, stdout };
}
