import { deny } from "../core/decision.ts";
import { firstUnitHit, type Policy } from "../core/policy.ts";

const BANNED = new Set(["grep", "egrep", "fgrep", "find"]);

export const NATIVE_SEARCH_REASON =
  "Bash grep/find blocked (native-search policy): use the built-in Grep and Glob tools instead — they are faster and zone-checked. ripgrep (rg) stays allowed as the CLI fallback.";

export const nativeSearchPolicy: Policy = {
  check(cmd) {
    return firstUnitHit(cmd.units, (unit) => {
      if (BANNED.has(unit.name.toLowerCase())) {
        return deny(NATIVE_SEARCH_REASON);
      }
      return unit.args.some((arg) => BANNED.has(arg.toLowerCase()))
        ? deny(NATIVE_SEARCH_REASON)
        : null;
    });
  },
  name: "native-search",
};
