import type { HookEvent, Settings } from "@anthropic-ai/claude-agent-sdk";

export type {
  HookEvent,
  PreModelSwitchHookSpecificOutput,
  PreToolUseHookInput,
  PreToolUseHookSpecificOutput,
  Settings,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";

export type SkillHooksConfig = NonNullable<Settings["hooks"]>;
export type HookMatcherGroup = SkillHooksConfig[string][number];
export type DeclarativeHandler = NonNullable<HookMatcherGroup["hooks"]>[number];
export type HookHandler = DeclarativeHandler;
type HookOf<K extends DeclarativeHandler["type"]> = Extract<
  DeclarativeHandler,
  { type: K }
>;
export type CommandHook = HookOf<"command">;
export type HttpHook = HookOf<"http">;
export type McpToolHook = HookOf<"mcp_tool">;
export type PromptHook = HookOf<"prompt">;
export type AgentHook = HookOf<"agent">;

export type SkillHooks = Partial<Record<HookEvent, HookMatcherGroup[]>>;
