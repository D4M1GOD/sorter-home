# SorterHome

Web app to plan storage rooms on a real-scale floor plan, place and stack
containers, and track every item inside them. Portfolio project.

Full requirements: @docs/requirements.md (read it before starting any task).

## Rules
- Do not assume requirements. If something is not defined in docs/requirements.md, ask first.
- Work in small steps, from simple to complex. One feature at a time.
- When there are several valid options, list them with pros and cons and recommend one. The owner decides.
- The owner is new to C#, .NET, Docker and Azure: explain the "why" when using them.
- Talk to the owner in Spanish. Code, comments, commit messages and docs are in English.
- UI text is in English.

## Stack
- Frontend: Angular + TypeScript, in `frontend/`
- Backend: C# ASP.NET Core Web API on .NET 10, in `backend/`
- Database: PostgreSQL (planned). Photos: Azure Blob Storage (planned).
- CI: GitHub Actions (planned)

## Conventions
- All lengths are stored as integer millimeters. Convert to feet/inches only in the display layer.
  Never hard-code a display unit outside the formatting/parsing layer.
- Commit messages use Conventional Commits: feat:, fix:, docs:, chore:, test:, refactor:
- Default branch is `main`. Work on feature branches and merge through pull requests.

## Commands
To be filled in during phase 1, when `frontend/` and `backend/` exist
(run, test and build commands for each).