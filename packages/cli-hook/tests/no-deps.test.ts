import { describe } from "bun:test";

import { noDepsPolicy, REASON } from "../src/policies/no-deps.ts";
import { ALLOW, DENY } from "./fixtures/no-deps.ts";
import { policyTableTests } from "./helpers/policy.ts";

describe("no-deps policy", () => {
  policyTableTests(noDepsPolicy, { allow: ALLOW, deny: DENY }, REASON);
});
