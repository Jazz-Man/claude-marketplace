/**
 * sandbox.credentials.envVars — variables unset before each sandboxed
 * command runs. This list is this key's alone; see config.ts for why lists
 * never share entries.
 */
import { unique } from "../utils.ts";

const envVars = [
  "GITHUB_TOKEN",
  "GITHUB_AUTH_TOKEN",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_PUBLICK_EMAIL",
  "GH_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "OPENAI_API_KEY",
  "HF_TOKEN",
  "HUGGINGFACE_TOKEN",
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "OLLAMA_API_KEY",
  "CONTEXT7_API_KEY",
  "QWEN_CODER_API",
  "INTELEPHENSE_LICENSE_KEY",
  "Z_AI_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "NPM_CONFIG_TOKEN",
  "NPM_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CARGO_REGISTRY_TOKEN",
  "GEM_HOST_API_KEY",
  // "TWINE_PASSWORD",
  // "PYPI_TOKEN",
  "VAULT_TOKEN",
  "SENTRY_AUTH_TOKEN",
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
  "SNYK_TOKEN",
];

export const credentialEnvVars = unique(envVars);
