export function sortByPriority<T extends { server: string }>(
  list: T[],
  priority: string[],
): T[] {
  return [...list].sort((left, right) => {
    const leftIndex = priority.indexOf(left.server);
    const rightIndex = priority.indexOf(right.server);
    if (leftIndex === -1 && rightIndex === -1) {
      return 0;
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}
