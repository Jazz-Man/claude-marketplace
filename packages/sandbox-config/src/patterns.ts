/** Pattern-list helpers shared by the catalog and the config assembly. */

/** Expand a name to both forms: directly under ~ and anywhere under ~. */
export const bothForms = (name: string): string[] => [
  `~/${name}`,
  `~/**/${name}`,
];

/** Deduplicate while preserving first-occurrence order. */
export const unique = (items: readonly string[]): string[] => [
  ...new Set(items),
];
