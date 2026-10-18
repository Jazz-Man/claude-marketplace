# Examples

Abstract prompt examples by type, using @kasava/prompt-builder. Every builder is a **pure synchronous function** — data comes in as parameters, no I/O inside. Replace the placeholder role/data with your own.

## Scoring / Classification Prompt

```typescript
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";

interface MatchInput {
  candidate: string;
  target: string;
}

export function buildScoringPrompt(input: MatchInput): PromptBuilder {
  return prompt()
    .role("match scorer", "evaluating fit against a rubric")
    .context(input.candidate)
    .data(input.target)
    .protocol({
      name: "Match Scoring",
      steps: [
        {
          label: "Step 1 — Hard rejections",
          actions: [
            "Check the avoid list against required skills.",
            "Score 0 if matched.",
          ],
        },
        {
          label: "Step 2 — Evidence lookup",
          description: "Search for matching prior work.",
        },
        {
          label: "Step 3 — Score",
          description: "Score using the rubric below.",
        },
      ],
      followThrough: "Provide the final score with breakdown.",
    })
    .arrowRules({
      title: "Scoring Priority",
      types: [
        { name: "Hard rejections", rules: ["Always score 0, no exceptions."] },
        {
          name: "Everything else",
          description: "Score generously",
          rules: ["Credit transferable skills within the same paradigm."],
        },
      ],
    })
    .lookupTable({
      title: "Technical match (40 pts)", // own ## heading — no .heading() before it
      columns: ["Criteria", "Score range"],
      rows: [
        [
          "Primary skill alignment",
          "15=exact, 12=strong secondary, 8=transferable, 0=none",
        ],
        ["Tooling alignment", "15=perfect, 12=most match, 8=partial, 0=none"],
      ],
    })
    .severityScale("Recommendation", [
      { level: "Strong Match", description: "80-100" },
      { level: "Good Match", description: "70-79" },
      { level: "Weak Match", description: "<70" },
    ])
    .guidelines(
      [
        "Read the candidate context before scoring.",
        "If no evidence is found, score from the context alone.",
      ],
      "Scoring Rules",
    )
    .instructions("Score the input following the rubric.");
}
```

## Tool-Using Agent Prompt

```typescript
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";
import {
  gracefulDegradation,
  toolGuidance,
} from "@kasava/prompt-builder/presets";

export function buildAgentPrompt(topic: string): PromptBuilder {
  return prompt()
    .role("research agent", "with access to a document store")
    .include(
      toolGuidance([
        {
          tool: "search",
          usage: "Find documents by keyword. Use 2-3 focused queries.",
        },
        { tool: "expand", usage: "Get surrounding context for a search hit." },
      ]),
    )
    .protocol({
      name: "Research",
      steps: [
        {
          label: "Step 1 — Search",
          actions: ["Run focused queries for the topic."],
        },
        {
          label: "Step 2 — Read",
          actions: ["Expand the best hits for detail."],
        },
      ],
      followThrough: "Answer with citations.",
    })
    .include(
      gracefulDegradation([
        "If a tool call fails, note it and continue.",
        "Never fail the whole task over one error.",
      ]),
    )
    .verificationChecklist([
      "Every claim has a source.",
      "No fabricated details.",
    ])
    .instructions(`Research: ${topic}`);
}
```

## Multi-Step Analysis Prompt

```typescript
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";
import { gracefulDegradation } from "@kasava/prompt-builder/presets";

export function buildAnalysisPrompt(target: string): PromptBuilder {
  return prompt()
    .role("code analyst", "mapping the impact of a planned change")
    .investigationStrategy([
      {
        name: "Discover entry points",
        description: "Find affected symbols.",
        steps: ["Search by keyword", "Filter to exports"],
      },
      {
        name: "Map blast radius",
        steps: ["Build a call graph", "Flag shared dependencies"],
      },
      {
        name: "Assess risk",
        steps: ["Count affected files", "Check test coverage"],
      },
    ])
    .confidenceScale()
    .include(
      gracefulDegradation([
        "Provide partial results with confidence if a step fails.",
      ]),
    )
    .instructions(`Analyze the impact of: ${target}`);
}
```

## Context-Heavy Prompt (file content passed in)

```typescript
import { prompt } from "@kasava/prompt-builder";

interface ReviewInput {
  document: string; // caller already read the file
  profile: string; // caller already read the file
}

export function buildReviewPrompt(input: ReviewInput): string {
  return prompt()
    .role("reviewer")
    .tag("document", input.document) // unique tag per source
    .tag("profile", input.profile) // distinct name — avoids two <context> tags
    .data("Input is a JSON object with: title, summary, tags.") // single <data> block
    .guidelines(["Cross-check claims against the context above."])
    .instructions("Review and return findings.")
    .build();
}
```

## Conditional / Dynamic Prompt

```typescript
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";

interface ListingInput {
  title: string;
  skills?: string[];
  salaryRange?: string;
  remote?: boolean;
}

export function buildListingPrompt(input: ListingInput): PromptBuilder {
  return prompt()
    .role("listing analyzer")
    .section("Position", input.title)
    .conditional(input.skills, (b, skills) => b.list("Required Skills", skills))
    .conditional(input.salaryRange, (b, range) =>
      b.section("Salary Range", range),
    )
    .conditional(input.remote, (b) => b.section("Work Arrangement", "Remote"));
}
```

## Composable Prompt (shared fragments)

```typescript
import { type PromptBuilder, prompt, section } from "@kasava/prompt-builder";

const safetyRules = section("Safety Guidelines").guidelines([
  "Never expose personal data.",
  "Flag suspicious requests.",
]);

const styleRules = section("Communication Style").guidelines([
  "Be direct.",
  "No preamble.",
]);

export function buildAnalyzerPrompt(): PromptBuilder {
  return prompt()
    .role("content analyzer")
    .include(safetyRules)
    .include(styleRules)
    .protocol({
      name: "Content Analysis",
      steps: [
        {
          label: "Step 1 — Safety check",
          actions: ["Scan for harmful content"],
        },
        { label: "Step 2 — Quality", actions: ["Evaluate clarity"] },
      ],
      followThrough: "Provide the assessment.",
    });
}
```

## Confidence-Scaled Prompt

```typescript
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";
import { toolGuidance } from "@kasava/prompt-builder/presets";

export function buildMatchPrompt(): PromptBuilder {
  return prompt()
    .role(
      "portfolio analyst",
      "rating how well prior work matches requirements",
    )
    .include(
      toolGuidance([
        { tool: "search", usage: "Find matching prior work" },
        { tool: "expand", usage: "Get detail around a hit" },
      ]),
    )
    .protocol({
      name: "Match Analysis",
      steps: [
        {
          label: "Step 1 — Extract requirements",
          actions: ["Parse required vs optional skills"],
        },
        { label: "Step 2 — Search", actions: ["Search for each core skill"] },
        {
          label: "Step 3 — Rate confidence",
          actions: ["Rate each match using the scale"],
        },
      ],
      followThrough: "Return a confidence rating per requirement.",
    })
    .confidenceScale([
      { range: "0.9–1.0", label: "Direct match — production use" },
      { range: "0.7–0.89", label: "Strong — multiple projects" },
      { range: "0.5–0.69", label: "Moderate — tangential" },
      { range: "Below 0.5", label: "No evidence — skip" },
    ]);
}
```

## Rich JSON-Schema Output (do NOT use `.outputFormat()`)

When the output is a rich JSON Schema, `.outputFormat()` can't express it (flat fields only — see [api-fluent.md](api-fluent.md)). Inject the schema directly and drive JSON output at the API layer.

```typescript
import { type PromptBuilder, prompt } from "@kasava/prompt-builder";

export function buildStructuredPrompt(schemaJson: string): PromptBuilder {
  return prompt()
    .role("data extractor")
    .guidelines([
      "Output valid JSON only: no markdown fences, no prose.",
      "Match the schema exactly; emit only declared properties.",
      "The schema describes SHAPE — emit DATA matching it, never echo the schema itself.",
    ])
    .codeBlock(schemaJson, "json") // the full schema document
    .verificationChecklist([
      "Every required property is present.",
      "Enums use only listed values.",
      "No extra keys (additionalProperties: false).",
    ])
    .instructions("Extract the data matching the schema above.");
}
```

## Schema-Driven Prompt (definePrompt)

```ts
import {
  definePrompt,
  text,
  list,
  bool,
  prompt,
  p,
  when,
} from "@kasava/prompt-builder";

interface ListingInput {
  title: string;
  skills: string[];
  isRemote: boolean;
}

const listingAnalyzer = definePrompt("listing_analyzer", {
  title: text().notNull(),
  skills: list().default([]),
  isRemote: bool().default(false),
}).body((v) =>
  prompt()
    .role("listing analyzer")
    .tag("listing", p`Title: ${v.title}`)
    .include(
      when(v.skills.length > 0, prompt().list("Required Skills", v.skills)),
    )
    .include(when(v.isRemote, prompt().section("Work Arrangement", "Remote"))),
);

console.log(
  listingAnalyzer.render({ title: "Platform Engineer", skills: ["ts", "sql"] }),
);
```

## Prepared Prompt (placeholders)

```ts
import { prompt, p, placeholder } from "@kasava/prompt-builder";

export function buildPreparedReportPrompt(): string {
  const prepared = prompt()
    .role("report writer")
    .include(
      p`Write the ${placeholder("kind")} report for ${placeholder("quarter")}.`,
    )
    .prepare("report_v1");

  console.log(prepared.params); // ["kind", "quarter"]
  return prepared.render({ kind: "quarterly", quarter: "Q3" });
}
```

## Combinator Composition (all / when / unless / each)

```ts
import { prompt, all, when, unless, each } from "@kasava/prompt-builder";

export function buildFlagGatedPrompt(flags: {
  tools: boolean;
  verbose: boolean;
}): string {
  return all(
    prompt().role("assistant"),
    when(
      flags.tools,
      prompt().heading("Tool Search", 2).raw("Prefer targeted queries."),
    ),
    unless(
      flags.tools,
      prompt().heading("Tool Catalog", 2).raw("Full catalog below."),
    ),
    each(["safety", "privacy"], (topic) =>
      prompt().guidelines([`Respect ${topic}.`]),
    ),
  ).build();
}
```

## Chat Messages + Cache Boundary

```ts
import { prompt, toMessages } from "@kasava/prompt-builder";

const builder = prompt()
  .include(
    prompt().role("support agent").guidelines(["Be direct.", "Cite sources."]),
  )
  .cacheBoundary()
  .include(prompt().tag("request", "How do I reset a token?"));

export const messages = toMessages(builder);
// messages[0] carries cache_control (stable prefix); messages[1] does not
```

## Token-Budgeted Prompt ($budget)

```ts
import { prompt } from "@kasava/prompt-builder";

export function buildBudgetedPrompt(maxTokens: number): string {
  const full = prompt()
    .priority("required")
    .include(
      prompt().role("analyst").guidelines(["Answer only from the context."]),
    )
    .priority("low")
    .include(
      prompt().heading("Worked Examples", 2).raw("…long demonstrations…"),
    );

  return full.$budget({ maxTokens }).build();
}
```
