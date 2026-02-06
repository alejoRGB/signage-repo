---
name: creating-skills
description: Creates new agent skills for the Antigravity environment. Use when the user asks to generate, build, or create a new skill, or mentions needing a SKILL.md file.
---

# Antigravity Skill Creator

## When to use this skill
- User asks to create a new skill
- User mentions building agent capabilities
- User needs a SKILL.md template

## Core Structural Requirements
Every skill must follow this folder hierarchy:
- `<skill-name>/`
    - `SKILL.md` (Required: Main logic and instructions)
    - `scripts/` (Optional: Helper scripts)
    - `examples/` (Optional: Reference implementations)
    - `resources/` (Optional: Templates or assets)

## YAML Frontmatter Standards
The `SKILL.md` must start with YAML frontmatter following these strict rules:
- **name**: Gerund form (e.g., `testing-code`, `managing-databases`). Max 64 chars. Lowercase, numbers, and hyphens only.
- **description**: Written in **third person**. Must include specific triggers/keywords. Max 1024 chars.

## Writing Principles
* **Conciseness**: Assume the agent is smart. Focus only on the unique logic of the skill.
* **Progressive Disclosure**: Keep `SKILL.md` under 500 lines. Link to secondary files if needed.
* **Forward Slashes**: Always use `/` for paths, never `\`.
* **Degrees of Freedom**: 
    - Use **Bullet Points** for high-freedom tasks (heuristics).
    - Use **Code Blocks** for medium-freedom (templates).
    - Use **Specific Bash Commands** for low-freedom (fragile operations).

## Workflow & Feedback Loops
For complex tasks, include:
1. **Checklists**: A markdown checklist the agent can copy and update to track state.
2. **Validation Loops**: A "Plan-Validate-Execute" pattern.
3. **Error Handling**: Instructions for scripts should be "black boxes"—tell the agent to run `--help` if unsure.

## Output Template
When creating a skill, use this format:

```markdown
---
name: [gerund-name]
description: [3rd-person description with triggers]
---

# [Skill Title]

## When to use this skill
- [Trigger 1]
- [Trigger 2]

## Workflow
[Insert checklist or step-by-step guide here]

## Instructions
[Specific logic, code snippets, or rules]

## Resources
- [Link to scripts/ or resources/]
```
