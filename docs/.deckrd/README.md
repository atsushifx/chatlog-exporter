---
title: Internal Design Directory
description: Purpose and usage of the .deckrd internal design directory
---

## .deckrd

This directory contains internal design and decision records
used during development.

- Documents under this directory are not part of the public API.
- Decisions are recorded as DR (Decision Records).
- This directory may be extracted as a standalone repository in the future.

## notes/

Documents under `notes/` are working notes and design drafts.

- Contents are not stable.
- They may be incomplete, outdated, or contradictory.
- Information here may later be promoted to requirements or decision records.

### How to Use

- Use `notes/` to record working ideas, design explorations, and unresolved discussions.
- Notes files should start with a datetime, e.g. `2025-12-26T21:38:00-about-agtKind.md`.
- When a design decision is finalized, promote the content to:
  - `decision-records/` for explicit design decisions (DR)
  - `requirements/` for agreed functional or non-functional requirements
- Do not treat documents under `notes/` as stable or authoritative.
