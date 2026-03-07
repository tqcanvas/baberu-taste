# AGENTS.md

## Project Purpose

This repository contains a monorepo for a content taste tracker application.

First iteration is a manga catalog, starting with AniList manga ingestion, and later expand to additional mediums such as anime, music and light novels.

The goal is to help users:
- browse entries in a memory-recallable format
- quickly score or rank content they have already consumed
- gradually build a user taste profile

The current priority is shipping a simple, correct, extensible proof of concept.

---

## Agent Operating Principles

- Always plan before implementing.
- For every non-trivial task:
    1. inspect the relevant code and files
    2. summarize current behavior
    3. propose an implementation plan
    4. identify files likely to change
    5. call out schema, API, or architecture impacts
    6. wait for approval before implementing major changes
- Prefer simple, maintainable implementations.
- Prefer minimal diffs over broad refactors.
- Do not refactor unrelated code unless explicitly asked.
- Major refactors must be done intentionally and discussed first.

---

## Project Priorities

When tradeoffs appear, prioritize in this order:

1. correctness and consistency of ingested data
2. maintainable structure and clear boundaries
3. fast iteration on the proof of concept
4. performance work only when justified by actual need

Avoid premature complexity.

---

## Repository Context

- Repository type: monorepo
- Language: TypeScript
- Frontend: React
- Database: Postgres
- Package manager: npm

Keep tooling simple unless added complexity is justified and approved.

---

## Git Workflow

- Create one branch per feature or focused task.
- Use branch names in one of these forms:
    - `feat/<name>`
    - `hotfix/<name>`
    - `experiment/<name>`
- Keep branches focused and reviewable.
- Do not touch unrelated files.
- Do not make broad repo-wide edits unless explicitly requested.

### Commit Rules

Use Conventional Commits:
- `feat:`
- `fix:`
- `refactor:`
- `build:`
- `ci:`
- `chore:`
- `docs:`
- `style:`
- `perf:`
- `test:`

Commits do not need to be extremely small, but they should be logical and understandable.

---

## Architecture Rules

- Discuss major architecture changes with the developer before implementing them.
- Plan folder architecture collaboratively rather than inventing it silently.
- Reuse existing patterns before introducing new abstractions.
- Avoid introducing new services, queues, or infrastructure without approval.
- Avoid new dependencies unless explicitly approved.
- Prefer normalized application data over storing raw external payloads.

---

## Schema Rules

- Schema direction should be discussed before implementation.
- Do not make unilateral schema changes, even if they seem small.
- When a task may affect the schema, surface:
    - proposed tables or columns
    - data ownership and normalization concerns
    - migration implications
    - ingestion implications
- Prefer schema decisions that support correctness, idempotent ingestion, and future multi-media expansion.

---

## Current Core Data Model

Current core entities include:

- `content_items`
    - shared fields across media types
    - examples: rating, popularity, title, short description, image_url

- `<type>_details`
    - media-specific fields
    - examples:
        - manga: chapter count, author, source link
        - anime: studio, episode count, source link

- `tags`
    - used for categorizing taste

- `content_titles`
    - used to support unified search and alternate titles

- `sources`
    - tracks source system information and identifiers

Do not introduce user-related schema yet unless approved.

---

## Product Direction

The first major workflow after ingestion is a fast rating and ranking flow.

Target direction:
- a user starts from scratch
- browses content they may have consumed before
- quickly recognizes entries
- rapidly scores or ranks them
- gradually builds a taste profile

When implementing features, prefer designs that support this workflow.

---

## Testing and Validation

Testing expectations should match the stage of the project.

- For small features, prefer focused unit tests.
- Add tests when practical, especially when changing behavior or ingestion logic.
- Over time, add broader integration coverage for larger workflows.
- Run relevant tests for the changed area instead of always running everything.
- Keep tasks scoped so validation remains efficient and understandable.

Before finishing a task, report:
- what was tested
- what passed
- what was not tested
- any known gaps or risks

Do not claim full validation if only partial validation was run.

---

## Code Style

- Prefer readable code over clever code.
- Keep comments sparse and only where they add real clarity.
- Follow existing project patterns once established.
- Keep modules focused and responsibilities clear.
- Do not introduce unnecessary abstraction layers early in the project.

---

## Dependency Rules

- Do not add new dependencies unless approved.
- When proposing a new dependency, explain:
    - why it is needed
    - what simpler alternatives were considered
    - what long-term maintenance cost it introduces

---

## Safety Rules

Never:
- commit secrets
- commit `.env` files
- introduce destructive database operations without explicit approval
- modify unrelated files
- add new dependencies without approval
- make silent architecture or schema changes

Ask before:
- changing schema direction
- introducing new infrastructure
- changing core folder structure
- expanding beyond AniList as a source

---

## Task Completion Format

When finishing a task, provide:
- what changed
- why it changed
- files touched
- tests run
- risks, assumptions, or follow-up work

Be explicit about tradeoffs and incomplete areas.

---

## Planning Template

For any non-trivial task, use this structure before coding:

1. Current state
2. Goal
3. Proposed approach
4. Files likely to change
5. Schema or API impact
6. Risks or open questions

Wait for developer approval before implementing major architecture or schema decisions.