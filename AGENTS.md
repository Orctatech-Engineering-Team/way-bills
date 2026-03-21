# AGENTS.md

## Project Context

- This repo is a `bun` monorepo.
- Workspace packages live under `apps/*` and `packages/*` as declared in the root [`package.json`](/home/bernard/Work/way-bills/package.json).
- Prefer workspace-aware commands from the repo root unless there is a clear reason to run inside a single app.

## Do

- Use `bun` for package management, script execution, and workspace operations.
- Run installs from the repo root with `bun install`.
- Use workspace-aware commands when appropriate, for example `bun run --filter frontend build` or `bun run --filter learning-hono dev`.
- Use `--cwd` when you need to target one app directly, for example `bun run --cwd apps/frontend test`.
- Add dependencies with `bun add` in the correct workspace, for example `bun add --cwd apps/frontend <pkg>`.
- Keep changes scoped to the relevant workspace instead of duplicating config across apps.
- Check the nearest `package.json` before adding scripts or dependencies.

## Do Not

- Do not use `npm`, `pnpm`, or `yarn` in this repo.
- Do not introduce another lockfile format.
- Do not install dependencies from inside a workspace if the same result should be managed from the repo root.
- Do not assume every workspace has the same scripts; verify the target workspace first.
- Do not move workspace packages outside `apps/*` or `packages/*` without updating the root workspace config.
- Do not edit `package.json` dependency entries by hand when `bun add` or `bun remove` should be used.

## Current Workspace Notes

- [`apps/frontend/package.json`](/home/bernard/Work/way-bills/apps/frontend/package.json) provides `dev`, `build`, `preview`, and `test`.
- [`apps/backend/package.json`](/home/bernard/Work/way-bills/apps/backend/package.json) currently provides `dev` and runs on `bun`.
- The root [`package.json`](/home/bernard/Work/way-bills/package.json) defines workspaces but does not currently define root scripts, so prefer workspace-targeted commands.
