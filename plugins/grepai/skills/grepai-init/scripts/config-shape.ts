const TOP_LEVEL: Record<string, "list" | "mapping" | "number" | "string"> = {
  chunking: "mapping",
  embedder: "mapping",
  external_gitignore: "string",
  framework_processing: "mapping",
  ignore: "list",
  rpg: "mapping",
  search: "mapping",
  store: "mapping",
  trace: "mapping",
  version: "number",
  watch: "mapping",
};

const NESTED_BLOCKS: Record<string, readonly string[]> = {
  framework_processing: ["frameworks"],
  search: ["boost", "dedup", "hybrid"],
  store: ["postgres", "qdrant"],
};

const WANTED: Record<string, string> = {
  list: "a list",
  mapping: "a block of keys",
  number: "a number",
  string: "a string",
};

function holdsExpected(
  expected: "list" | "mapping" | "number" | "string",
  value: unknown,
): boolean {
  if (expected === "mapping") {
    return isMapping(value);
  }
  if (expected === "list") {
    return Array.isArray(value);
  }
  return typeof value === expected;
}

function nestedProblems(key: string, block: Record<string, unknown>): string[] {
  return (NESTED_BLOCKS[key] ?? []).flatMap((nested) => {
    const inner = block[nested];
    return nested in block && !isMapping(inner)
      ? [
          `\`${key}.${nested}\` must hold a block of keys, but holds ${shapeOf(inner)}: a block indented one level too little reads as empty`,
        ]
      : [];
  });
}

function topLevelProblems(config: Record<string, unknown>): string[] {
  return Object.entries(config).flatMap(([key, value]) => {
    const expected = TOP_LEVEL[key];
    if (expected === undefined) {
      return [
        `unknown top-level key \`${key}\`: grepai ignores it and drops it when it next saves the file`,
      ];
    }
    if (!holdsExpected(expected, value)) {
      return [
        `\`${key}\` must hold ${WANTED[expected]}, but holds ${shapeOf(value)}`,
      ];
    }
    return expected === "mapping"
      ? nestedProblems(key, value as Record<string, unknown>)
      : [];
  });
}

function duplicateKeys(text: string): string[] {
  const firstLine = new Map<string, number>();
  const problems: string[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    const key = /^(?<key>[A-Za-z_][\w-]*):(?:\s|$)/u.exec(line)?.groups?.key;
    if (key !== undefined) {
      const first = firstLine.get(key);
      if (first === undefined) {
        firstLine.set(key, index + 1);
      } else {
        problems.push(
          `\`${key}\` is defined twice (lines ${first} and ${index + 1}); only the last one is read`,
        );
      }
    }
  }
  return problems;
}

export const isMapping = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const listOfStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const shapeOf = (value: unknown): string => {
  if (value === null) {
    return "nothing";
  }
  return Array.isArray(value) ? "a list" : `a ${typeof value}`;
};

export function configProblems(
  text: string,
  config: Record<string, unknown>,
): string[] {
  return [...duplicateKeys(text), ...topLevelProblems(config)];
}
