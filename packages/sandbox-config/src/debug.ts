import { inspect } from "bun";

export function debug(object: unknown, options: Bun.BunInspectOptions = {}) {
  const text = inspect(object, {
    colors: true,
    depth: 2,
    ...options,
  });

  console.log(text);
}
