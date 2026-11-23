/**
 * claudeMdExcludes — CLAUDE.md files skipped when memory loads. This list is
 * this key's alone; see config.ts for why lists never share entries.
 */
import { dependencyMemoryFiles, unique } from "../utils.ts";

// Agent instruction files and the directories tools keep them in. Denied so
// that instructions found inside dependencies or stale agent memory cannot
// steer agents.
const dependencyFolders = ["node_modules", "vendor", "Pods", ".venv", "venv"];

const dependencyPrefixes = ["/opt/homebrew"];

const dependencyCacheRoots = ["~/.cargo/registry/src", "~/go/pkg/mod"];

const dependencyMemoryNames = [
  "CLAUDE.md",
  "AGENTS.md",
  "QWEN.md",
  "GEMINI.md",
  "COPILOT.md",
  "CONVENTIONAL.md",
  "copilot-instructions.md",
  ".cursorrules",
  ".clinerules",
  ".windsurfrules",
];

// Commented-out entries are deliberate owner exclusions — do not re-add them.
const dependencyMemoryDirs = [
  ".claude",
  ".cursor",
  // ".aider-desk",
  // ".agents",
  // ".autohand",
  // ".augment",
  // ".bob",
  // ".codeartsdoer",
  // ".codebuddy",
  // ".codemaker",
  // ".codestudio",
  // ".commandcode",
  // ".continue",
  // ".cortex",
  // ".crush",
  // ".devin",
  // ".forge",
  // ".goose",
  // ".grok",
  // ".hermes",
  // ".iflow",
  // ".inferencesh",
  // ".jazz",
  // ".junie",
  // ".kiro",
  // ".kode",
  // ".lingma",
  // ".mcpjam",
  // ".minimax",
  // ".moxby",
  // ".mux",
  // ".neovate",
  // ".ona",
  // ".openhands",
  // ".pochi",
  // ".posit/assistant",
  // ".qoder",
  ".qwen",
  // ".reasonix",
  // ".roo",
  // ".rovodev",
  // ".tabnine/agent",
  // ".terramind",
  // ".tinycloud",
  // ".trae",
  // ".windsurf",
  // ".zcode",
  // ".zencoder",
  // ".adal",
  // "skills",
];

export const claudeMdExcludes = unique(
  dependencyMemoryFiles({
    cacheRoots: dependencyCacheRoots,
    dirs: dependencyMemoryDirs,
    folders: dependencyFolders,
    names: dependencyMemoryNames,
    prefixes: dependencyPrefixes,
  }),
);
