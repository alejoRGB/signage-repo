---
name: Canonical Context Manager
description: |
  Manages long-lived project knowledge by maintaining a clean, minimal canonical context.
  Allows free exploration while preventing context pollution over time.
  Ensures safe session termination without losing critical information.
---

# Canonical Context Manager

## Trigger Phrases
- "finalizar tarea"
- "cerrar sesión"
- "freeze context"
- "actualizar contexto canónico"
- "update canonical context"
- "close task"

## Instructions

### Core Principle
Conversations are temporary. Canonical Context is permanent.

### Canonical Context Definition
The single source of truth for the project, consisting ONLY of:
- Stable decisions
- Hard constraints
- Confirmed architecture
- Non-negotiable rules
- Agreed workflows

POLESTAR: Never include conversation history, speculation, open questions, temporary experiments, or agent reasoning.

### Canonical Files Location
Store canonical context in Markdown files inside the project:
- `/skills/project/PROJECT.md`
- `/skills/project/ARCHITECTURE.md`
- `/skills/project/MPV.md`
- `/skills/project/DEPLOYMENT.md`

These files are normative. If conflict exists between conversation and files, files win.

### Workflow

#### User Phase (before trigger)
1. User works freely with agent
2. Adds features, refactors, explores alternatives
3. Signals completion with trigger phrase

#### Agent Phase (after trigger ONLY)

**Step 1: Analyze Conversation**
Extract ONLY:
- Final decisions
- New constraints
- Modified assumptions
- Removed/deprecated rules

Ignore:
- Discussion back-and-forth
- Draft ideas not explicitly accepted
- Speculation

**Step 2: Classify Changes**
Each item must be:
- ADD: New canonical knowledge
- MODIFY: Change to existing knowledge
- REMOVE: Explicitly deprecated knowledge
- NO-OP: Nothing canonical changed

**Step 3: Determine Target Files**
- Identify correct canonical file
- Propose creating file if needed
- NO duplication across files

**Step 4: Update Canonical Context**
Requirements:
- Update files minimally
- Preserve existing structure
- Use clear, declarative language
- Avoid conversational tone
- One concept → one place
- No redundancy
- No timestamps
- No references to agents or conversations

**Step 5: Validation**
Ensure:
- No contradictions with existing canon
- No speculative language ("might", "could", "maybe")
- No implementation details unless explicitly architectural
- No user intent assumptions

If ambiguity exists, ask ONE final clarification question.
If no ambiguity, proceed silently.

**Step 6: Completion Output**
Respond with:
- Concise summary of changes (bullet points)
- List of files touched
- Confirmation message: "Canonical Context actualizado. La sesión puede cerrarse sin pérdida de información."

NO further suggestions or follow-up questions unless explicitly requested.

## Constraints
- This skill MUST NOT run automatically without user trigger
- This skill MUST NOT store conversational memory
- This skill MUST NOT expand scope beyond confirmed changes
- This skill MUST prioritize correctness over completeness

## Examples

### Example 1
**User:** "finalizar tarea"
**Expected Behavior:**
1. Review conversation for final decisions only
2. Classify changes as ADD/MODIFY/REMOVE/NO-OP
3. Update appropriate canonical files
4. Provide summary and confirmation
5. Do not offer further suggestions

### Example 2
**User:** "actualizar contexto canónico"
**Expected Behavior:**
Same as above - extract only confirmed changes, update canonical files, confirm completion.

### Example 3
**User:** "Discussing various approaches to authentication"
**Expected Behavior:**
DO NOT trigger this skill. Continue normal conversation. Wait for explicit trigger phrase.
