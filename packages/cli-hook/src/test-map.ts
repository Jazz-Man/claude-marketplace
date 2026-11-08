export type Pattern = readonly string[];

const subs = (...groups: readonly (readonly string[])[]): readonly Pattern[] =>
  [...new Set(groups.flat())].map((pattern) => pattern.split(" "));

const prefixed = (prefix: string, list: readonly string[]): string[] =>
  list.map((subcommand) => `${prefix} ${subcommand}`);

const except = (
  list: readonly string[],
  ...skip: readonly string[]
): string[] => list.filter((subcommand) => !skip.includes(subcommand));

const ADD = "add";
const BUNDLE = "bundle";
const CACHE = "cache";
const CI = "ci";
const CREATE = "create";
const DOWNLOAD = "download";
const EXEC = "exec";
const FETCH = "fetch";
const GLOBAL = "global";
const I = "i";
const IMPORT = "import";
const INIT = "init";
const INSTALL = "install";
const LINK = "link";
const LN = "ln";
const LOCK = "lock";
const REINSTALL = "reinstall";
const REMOVE = "remove";
const RM = "rm";
const RUN = "run";
const SYNC = "sync";
const UN = "un";
const UNINSTALL = "uninstall";
const UNLINK = "unlink";
const UP = "up";
const UPDATE = "update";
const UPGRADE = "upgrade";
const WHEEL = "wheel";
const X = "x";

const INSTALL_ALIASES = [I, INSTALL] as const;
const LINK_ALIASES = [LINK, UNLINK] as const;
const REMOVE_ALIASES = [REMOVE, RM, UN, UNINSTALL] as const;
const UPDATE_ALIASES = [UP, UPDATE, UPGRADE] as const;
const PIP_ALIASES = [DOWNLOAD, INSTALL, LOCK, UNINSTALL, WHEEL] as const;
const POETRY_ALIASES = [ADD, INSTALL, LOCK, REMOVE, SYNC, UPDATE] as const;
const SELF_UPDATE = prefixed("self", [UPDATE]);

export const mutableCommands = new Map<string, readonly Pattern[]>();

mutableCommands.set(
  "bun",
  subs(
    [ADD, CREATE, INIT, X],
    INSTALL_ALIASES,
    LINK_ALIASES,
    except(REMOVE_ALIASES, UNINSTALL),
    except(UPDATE_ALIASES, UPGRADE),
  ),
);
mutableCommands.set("bunx", subs());
mutableCommands.set(
  "bundle",
  subs([ADD, CACHE, INSTALL, LOCK, REMOVE, UPDATE, "package"]),
);
mutableCommands.set(
  "cargo",
  subs([
    ADD,
    FETCH,
    INSTALL,
    REMOVE,
    RM,
    UNINSTALL,
    UPDATE,
    "binstall",
    "generate-lockfile",
    "vendor",
  ]),
);
mutableCommands.set(
  "composer",
  subs([
    GLOBAL,
    INSTALL,
    REINSTALL,
    REMOVE,
    UPDATE,
    "create-project",
    "require",
    "self-update",
    "selfupdate",
  ]),
);
mutableCommands.set(
  "deno",
  subs(
    [
      ADD,
      BUNDLE,
      CACHE,
      CI,
      CREATE,
      INSTALL,
      LINK,
      REMOVE,
      UNINSTALL,
      X,
      "compile",
    ],
    except(UPDATE_ALIASES, UP),
  ),
);
mutableCommands.set("gem", subs(["cleanup", INSTALL, UNINSTALL, UPDATE]));
mutableCommands.set(
  "go",
  subs(
    ["get", INSTALL],
    prefixed("mod", [DOWNLOAD, "tidy", "vendor"]),
    prefixed("work", [SYNC]),
  ),
);
mutableCommands.set(
  "nix",
  subs(
    ["build", BUNDLE, "develop", RUN, "shell", "upgrade-nix"],
    prefixed("profile", [INSTALL, REMOVE, UPGRADE]),
  ),
);
mutableCommands.set(
  "npm",
  subs(
    [
      ADD,
      CACHE,
      CI,
      CREATE,
      EXEC,
      INIT,
      LINK,
      LN,
      "ddp",
      "dedupe",
      "dist-tag",
      "install-ci-test",
      "install-scripts",
      "install-test",
      "rebuild",
    ],
    INSTALL_ALIASES,
    REMOVE_ALIASES,
    except(UPDATE_ALIASES, UPGRADE),
  ),
);
mutableCommands.set("npx", subs());
mutableCommands.set("pip", subs(PIP_ALIASES));
mutableCommands.set(
  "pipx",
  subs([
    INSTALL,
    REINSTALL,
    RUN,
    UNINSTALL,
    UPGRADE,
    "inject",
    "install-all",
    "reinstall-all",
    "reset",
    "runpip",
    "uninject",
    "uninstall-all",
    "upgrade-all",
    "upgrade-shared",
  ]),
);
mutableCommands.set(
  "pnpm",
  subs(
    [
      ADD,
      CI,
      CREATE,
      EXEC,
      FETCH,
      IMPORT,
      LINK,
      LN,
      UNLINK,
      "approve-builds",
      "deploy",
      "dislink",
      "dlx",
      "env",
      "ic",
      "patch",
      "runtime",
      "self-update",
      "uni",
      "with",
    ],
    INSTALL_ALIASES,
    REMOVE_ALIASES,
    UPDATE_ALIASES,
    prefixed("store", [ADD]),
  ),
);
mutableCommands.set("pnpx", subs());
mutableCommands.set(
  "poetry",
  subs(
    POETRY_ALIASES,
    prefixed("python", [INSTALL]),
    prefixed("self", POETRY_ALIASES),
    prefixed("source", [ADD]),
  ),
);
mutableCommands.set("python", subs(prefixed("-m pip", PIP_ALIASES)));
mutableCommands.set(
  "rustup",
  subs(
    [INSTALL, UNINSTALL, UPDATE],
    SELF_UPDATE,
    prefixed("component", [ADD]),
    prefixed("target", [ADD]),
    prefixed("toolchain", [INSTALL, UNINSTALL]),
  ),
);
mutableCommands.set(
  "swift",
  subs(
    prefixed("package", [
      INSTALL,
      UPDATE,
      "add-dependency",
      "experimental-install",
      "experimental-uninstall",
      "resolve",
    ]),
  ),
);
mutableCommands.set(
  "uv",
  subs(
    [ADD, LOCK, REMOVE, RUN, SYNC],
    prefixed("pip", except(PIP_ALIASES, LOCK)),
    prefixed("python", [INSTALL]),
    prefixed("tool", [INSTALL, RUN, UNINSTALL, UPGRADE]),
    SELF_UPDATE,
  ),
);
mutableCommands.set("uvx", subs());
mutableCommands.set(
  "yarn",
  subs(
    [ADD, CREATE, GLOBAL, IMPORT, "upgrade-interactive"],
    INSTALL_ALIASES,
    LINK_ALIASES,
    REMOVE_ALIASES,
    UPDATE_ALIASES,
  ),
);
