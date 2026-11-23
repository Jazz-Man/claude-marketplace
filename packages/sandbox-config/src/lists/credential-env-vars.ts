interface EnvVarEntry {
  injectHosts?: readonly string[];
  mode: "deny" | "mask";
  name: string;
}

const masked = (
  names: readonly string[],
  injectHosts: readonly string[],
): EnvVarEntry[] => names.map((name) => ({ injectHosts, mode: "mask", name }));

const denied = (names: readonly string[]): EnvVarEntry[] =>
  names.map((name) => ({ mode: "deny", name }));

export const credentialEnvVars = [
  ...masked(
    [
      "GITHUB_TOKEN",
      "GITHUB_AUTH_TOKEN",
      "GITHUB_PERSONAL_ACCESS_TOKEN",
      "GH_TOKEN",
    ],
    ["api.github.com"],
  ),
  ...masked(["OPENAI_API_KEY"], ["api.openai.com"]),
  ...masked(
    ["HF_TOKEN", "HUGGINGFACE_TOKEN"],
    ["huggingface.co", "router.huggingface.co"],
  ),
  ...masked(
    ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
    ["api.anthropic.com"],
  ),
  ...masked(
    ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
    ["generativelanguage.googleapis.com"],
  ),
  ...masked(["OLLAMA_API_KEY"], ["ollama.com"]),
  ...masked(
    ["CONTEXT7_API_KEY"],
    ["context7.com", "api.context7.com", "mcp.context7.com"],
  ),
  ...masked(["Z_AI_API_KEY"], ["api.z.ai", "open.bigmodel.cn"]),
  ...masked(["NPM_CONFIG_TOKEN", "NPM_TOKEN"], ["registry.npmjs.org"]),
  ...masked(["CARGO_REGISTRY_TOKEN"], ["crates.io"]),
  ...masked(["GEM_HOST_API_KEY"], ["rubygems.org"]),
  ...masked(["SENTRY_AUTH_TOKEN"], ["sentry.io"]),
  ...masked(["SNYK_TOKEN"], ["api.snyk.io", "app.snyk.io"]),
  ...denied([
    "GITHUB_PUBLICK_EMAIL",
    "GH_ENTERPRISE_TOKEN",
    "GITHUB_ENTERPRISE_TOKEN",
    "QWEN_CODER_API",
    "INTELEPHENSE_LICENSE_KEY",
    "ANTHROPIC_BASE_URL",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    // "TWINE_PASSWORD",
    // "PYPI_TOKEN",
    "VAULT_TOKEN",
    "DOCKER_PASSWORD",
    "KUBECONFIG",
    "SSH_AUTH_SOCK",
    "BASH_ENV",
    "GIT_SSH_COMMAND",
    "GIT_ASKPASS",
    "GIT_EDITOR",
    "GIT_CONFIG",
    "GIT_CONFIG_GLOBAL",
    "GIT_PAGER",
    "PAGER",
    "EDITOR",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
    "NGROK_AUTHTOKEN",
  ]),
];
