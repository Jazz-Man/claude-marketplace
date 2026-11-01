import { describe } from "bun:test";

import {
  NATIVE_SEARCH_REASON,
  nativeSearchPolicy,
} from "../src/policies/native-search.ts";
import { ALLOW, DENY } from "./fixtures/native-search.ts";
import { policyTableTests } from "./helpers/policy.ts";

describe("native-search policy", () => {
  policyTableTests(
    nativeSearchPolicy,
    { allow: ALLOW, deny: DENY },
    NATIVE_SEARCH_REASON,
  );
});
