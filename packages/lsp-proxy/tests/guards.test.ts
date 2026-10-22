import { describe, expect, it } from "bun:test";

import {
  asArray,
  asRecord,
  ConfigError,
  isNonEmptyString,
  isRecord,
  isStringArray,
  isStringRecord,
} from "../src/guards/index.ts";

describe("isRecord", () => {
  it.each([
    [{}, true],
    [{ key: "value" }, true],
    [null, false],
    [undefined, false],
    [[1, 2], false],
    ["string", false],
    [42, false],
  ])("isRecord(%p) → %p", (value, expected) => {
    expect(isRecord(value)).toBe(expected);
  });
});

describe("isNonEmptyString", () => {
  it.each([
    ["hello", true],
    ["", false],
    [42, false],
    [null, false],
    [undefined, false],
  ])("isNonEmptyString(%p) → %p", (value, expected) => {
    expect(isNonEmptyString(value)).toBe(expected);
  });
});

describe("isStringArray", () => {
  it.each([
    [["a", "b"], true],
    [[], true],
    [["a", 42], false],
    [[null], false],
    ["string", false],
    [null, false],
  ])("isStringArray(%p) → %p", (value, expected) => {
    expect(isStringArray(value)).toBe(expected);
  });
});

describe("isStringRecord", () => {
  it.each([
    [{ key: "value" }, true],
    [{}, true],
    [{ key: 42 }, false],
    [{ key: null }, false],
    [null, false],
    [[1], false],
  ])("isStringRecord(%p) → %p", (value, expected) => {
    expect(isStringRecord(value)).toBe(expected);
  });
});

describe("asRecord", () => {
  it("returns the record for valid input", () => {
    expect(asRecord({ key: 1 }, "test")).toEqual({ key: 1 });
  });

  it.each([
    [null],
    [42],
  ])("asRecord(%p) throws ConfigError", (value) => {
    expect(() => asRecord(value, "test context")).toThrow(ConfigError);
    expect(() => asRecord(value, "test context")).toThrow("test context");
  });
});

describe("asArray", () => {
  it("returns the array for valid input", () => {
    expect(asArray([1, 2], "test")).toEqual([1, 2]);
  });

  it.each([
    ["string"],
    [null],
  ])("asArray(%p) throws ConfigError", (value) => {
    expect(() => asArray(value, "test context")).toThrow(ConfigError);
  });
});

describe("ConfigError", () => {
  it("carries field context", () => {
    const error = new ConfigError("servers[0].name", "string", 42);
    expect(error.field).toBe("servers[0].name");
    expect(error.expected).toBe("string");
    expect(error.actual).toBe("number");
    expect(error.message).toContain("servers[0].name");
    expect(error.message).toContain("string");
    expect(error.message).toContain("number");
  });
});
