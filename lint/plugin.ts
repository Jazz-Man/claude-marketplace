import type { Rule } from "eslint";

interface NoCommentsOptions {
  allow?: string[];
}

const SYSTEM_PREFIXES: readonly string[] = [
  "eslint-disable",
  "eslint-enable",
  "prettier-ignore",
  "@ts-",
  "biome-ignore",
];

const GUARDED_RULE_NAMES: readonly string[] = ["no-comments"];

function trimmedText(comment: { value: string }): string {
  return comment.value.replace(/^\*+/u, "").trim();
}

function startsWithAny(text: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => text.startsWith(prefix));
}

function isNoCommentsOptions(value: unknown): value is NoCommentsOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("allow" in value) || Array.isArray(value.allow))
  );
}

export function reportForbiddenComments<CommentNode extends { value: string }>(
  options: unknown[],
  comments: readonly CommentNode[],
  report: (comment: CommentNode) => void,
): void {
  const provided = options.find((option) => isNoCommentsOptions(option));
  const allowed: readonly string[] = [
    ...SYSTEM_PREFIXES,
    ...(provided?.allow ?? []),
  ];
  for (const comment of comments) {
    const text = trimmedText(comment);
    const allowedPrefix = startsWithAny(text, allowed);
    const disablesOwnRule = GUARDED_RULE_NAMES.some((name) =>
      text.includes(name),
    );
    if (!allowedPrefix || disablesOwnRule) {
      report(comment);
    }
  }
}

const noComments: Rule.RuleModule = {
  create(context) {
    return {
      Program() {
        reportForbiddenComments(
          context.options,
          context.sourceCode.getAllComments(),
          (comment) => {
            context.report({ loc: comment.loc, messageId: "forbidden" });
          },
        );
      },
    };
  },
  meta: {
    docs: { description: "Comments are not allowed in this repository" },
    messages: { forbidden: "Comments are not allowed." },
    schema: [
      {
        additionalProperties: false,
        properties: {
          allow: { items: { type: "string" }, type: "array" },
        },
        type: "object",
      },
    ],
    type: "problem",
  },
};

const localPlugin = {
  meta: { name: "local" },
  rules: { "no-comments": noComments },
};

export default localPlugin;
