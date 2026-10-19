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
export type CommandHook = Extract<DeclarativeHandler, { type: "command" }>;
export type HttpHook = Extract<DeclarativeHandler, { type: "http" }>;
export type McpToolHook = Extract<DeclarativeHandler, { type: "mcp_tool" }>;
export type PromptHook = Extract<DeclarativeHandler, { type: "prompt" }>;
export type AgentHook = Extract<DeclarativeHandler, { type: "agent" }>;

export type SkillHooks = Partial<Record<HookEvent, HookMatcherGroup[]>>;
