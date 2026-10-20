const DEFAULT_TARGET = "bun-darwin-arm64";

export type BuildLike = (config: unknown) => Promise<{
  logs: unknown[];
  success: boolean;
}>;

export interface BuildOptions {
  binName: string;
  entrypoints: string[];
  target?: string;
}

export class BuildFailure extends Error {}

export function deriveOutfile(binName: string, home: string): string {
  return `${home}/.local/bin/${binName}`;
}

export const toBuildConfig = (options: BuildOptions, home: string) => ({
  bytecode: true,
  compile: {
    autoloadBunfig: false,
    autoloadDotenv: false,
    outfile: deriveOutfile(options.binName, home),
    target: options.target ?? DEFAULT_TARGET,
  },
  entrypoints: options.entrypoints,
  minify: true,
  sourcemap: "linked",
});

export async function buildBinary(
  options: BuildOptions,
  home: string,
  build: BuildLike = Bun.build as unknown as BuildLike,
) {
  const result = await build(toBuildConfig(options, home));
  if (!result.success) {
    throw new BuildFailure(`bun build failed: ${JSON.stringify(result.logs)}`);
  }
  console.info(result);
}
