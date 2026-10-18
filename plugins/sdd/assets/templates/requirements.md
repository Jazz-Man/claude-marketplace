# Requirements Document

## Introduction

Introduce the feature in one or two short paragraphs: the problem it solves,
for whom, and the value it delivers. Stay at the WHAT level - no technology
choices, no architecture, no implementation detail.

## Boundary Context (Optional)

Include this section only when the scope could be misread or the feature
touches adjacent systems or specs:

- **In scope**: behaviors this feature owns
- **Out of scope**: behaviors explicitly excluded
- **Adjacent expectations**: what this feature expects from adjacent systems
  or specs, and what it does not own

## Requirements

Group requirements by area. Requirement headings MUST include a leading
numeric ID only (for example: "Requirement 1: ...", "1. Overview",
"2 Feature: ..."). Alphabetic IDs like "Requirement A" are not allowed.

### Requirement 1: [requirement area]

**Objective:** As a [role], I want [capability], so that [benefit]

#### Acceptance Criteria

Write every criterion in EARS syntax:

Patterns: follow `${CLAUDE_PLUGIN_ROOT}/assets/rules/ears-format.md` exactly.

Additional requirements follow the same pattern: heading with the next
numeric ID, an Objective line, and EARS acceptance criteria. Every
criterion must be testable and describe a single behavior.
