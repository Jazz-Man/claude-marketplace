export const bothForms = (name: string): string[] => [
  // `~/${name}`,
  `~/**/${name}`,
];

export const unique = (items: readonly string[]): string[] => [
  ...new Set(items),
];

export const pathsToRules = (paths: readonly string[], ...tools: string[]) =>
  tools.flatMap((tool) => paths.map((path) => `${tool}(${path})`));

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
