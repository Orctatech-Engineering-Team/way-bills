# Frontend

This workspace contains the operations UI for admins, ops staff, and riders.

## Main Responsibilities

- login and authenticated workspace shell
- waybill creation and review
- rider shift dashboard
- delivery proof capture flow
- reports and invoice review
- notification center
- responsive mobile/tablet/desktop operations experience

## Main Entry Points

- app bootstrap: [src/main.tsx](/home/bernard/Work/way-bills/apps/frontend/src/main.tsx)
- shared shell: [src/components/AppLayout.tsx](/home/bernard/Work/way-bills/apps/frontend/src/components/AppLayout.tsx)
- main pages: [src/pages](/home/bernard/Work/way-bills/apps/frontend/src/pages)
- shared API/types: [src/lib](/home/bernard/Work/way-bills/apps/frontend/src/lib)

## Commands

From the repo root:

```bash
bun run --cwd apps/frontend dev
bun run --cwd apps/frontend test
bun run --cwd apps/frontend typecheck
bun run --cwd apps/frontend build
```

## Important Folders

- `src/pages`: route-level screens
- `src/components`: shared UI building blocks
- `src/lib`: API client, formatters, utilities, exports
- `src/auth`: auth context and session handling
- `src/feedback`: toast/error feedback
- `src/theme`: theme provider and theme state

## Related Docs

- [Root README](/home/bernard/Work/way-bills/README.md)
- [Architecture Overview](/home/bernard/Work/way-bills/docs/architecture.md)
- [Deployment Guide](/home/bernard/Work/way-bills/deploy/README.md)
