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

## How we work
- Plan first. For every task, give a plan and wait for the owner's approval before writing code.
  The plan lists: the data model changes, the files to create or change, every question or doubt
  (with options, pros and cons, and a recommendation), the tests to write, and what the owner
  must test by hand.
- Stay inside the task. Do not change, clean up or reformat anything that was not discussed
  (this includes Prettier, line endings, comments and UI texts outside the task). If you find
  something unexpected, stop and tell the owner first.
- Explain the "why" briefly for anything new.
- When the work is done, run the tests and the build, then report: the files created or changed,
  the test and build results, what you decided or were unsure about, and what the owner must
  test by hand. Say clearly what the automated tests cannot check (real mouse and touch, layout,
  screen readers).
- Change docs/requirements.md only when the task asks for it. Show the diff, and keep the
  file's line endings and its final newline.

## Git
- The owner writes every git command. Never run a command that changes the repository:
  add, commit, switch, checkout, merge, rebase, push, pull, restore, reset, stash.
- You may run read-only commands: status, log, diff and listing branches (with `--no-pager`).

## Stack
- Frontend: Angular + TypeScript, in `frontend/`
- Backend: C# ASP.NET Core Web API on .NET 10, in `backend/`: solution `SorterHome.slnx` with
  `SorterHome.Api`, `SorterHome.Domain`, `SorterHome.Infrastructure` and `SorterHome.Tests`
- Database: PostgreSQL (planned). Photos: Azure Blob Storage (planned).
- CI: GitHub Actions (planned)

## Conventions
- All lengths are stored as integer millimeters. Convert to feet/inches only in the display layer.
  Never hard-code a display unit outside the formatting/parsing layer.
- Commit messages use Conventional Commits: feat:, fix:, docs:, chore:, test:, refactor:
- Default branch is `main`. Work on feature branches and merge through pull requests.
- Use the words of docs/requirements.md in code and in the UI: room, container, stack, item
  (for example "stack", never "pile").
- Stored data is loaded tolerantly: never discard well-formed data, repair a bad field when
  possible, and discard only what cannot be used. Store methods validate by themselves and
  change nothing if they fail.
- Pure logic lives in `frontend/src/app/core/` with unit tests.
- A UI state must never rely on color alone.
- Angular conventions for the frontend are in `frontend/CLAUDE.md`.
- Backend conventions are in `backend/CLAUDE.md`.

## Commands
Frontend (run from `frontend/`):
- `npm start`: development server at http://localhost:4200
- `ng test --watch=false`: run the unit tests once (Vitest)
- `ng build`: production build

Backend (run from `backend/`):
- `dotnet build`: build all the projects
- `dotnet test`: run the backend tests (xUnit)
- `dotnet run --project SorterHome.Api`: development server at http://localhost:5080; health at
  `/api/health`, OpenAPI document at `/openapi/v1.json` (Development only)
