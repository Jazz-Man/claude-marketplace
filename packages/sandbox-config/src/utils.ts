/**
 * Pure helpers for the per-key lists: pattern expansion, dedupe, and rule
 * shaping. No paths live here — every list owns its entries.
 */

/** Expand a name to both forms: directly under ~ and anywhere under ~. */
export const bothForms = (name: string): string[] => [
  // `~/${name}`,
  `~/**/${name}`,
];

/** Deduplicate while preserving first-occurrence order. */
export const unique = (items: readonly string[]): string[] => [
  ...new Set(items),
];

/** Wrap each path or command pattern in a `Tool(...)` permission rule. */
export const pathsToRules = (paths: readonly string[], ...tools: string[]) =>
  tools.flatMap((tool) => paths.map((path) => `${tool}(${path})`));

/**
 * Agent instruction files reachable inside dependency trees, curated sources,
 * and dependency caches.
 */
export const dependencyMemoryFiles = ({
  cacheRoots,
  dirs,
  folders,
  names,
  prefixes,
}: {
  cacheRoots: readonly string[];
  dirs: readonly string[];
  folders: readonly string[];
  names: readonly string[];
  prefixes: readonly string[];
}): string[] => {
  const entries = [...names, ...dirs.map((dir) => `${dir}/**`)];

  return unique([
    ...folders.flatMap((folder) =>
      entries.map((entry) => `~/**/${folder}/**/${entry}`),
    ),
    ...prefixes.flatMap((prefix) =>
      [...names, ...dirs].flatMap((entry) => [
        `${prefix}/${entry}`,
        `${prefix}/**/${entry}`,
      ]),
    ),
    ...cacheRoots.flatMap((root) =>
      entries.map((entry) => `${root}/**/${entry}`),
    ),
  ]);
};
