# Session 3 — Next.js Web App

## Important: Rename one folder after unzipping

The dynamic route folder is named `__address__` in this zip because
zip tools strip square brackets. Before running, rename it:

```bash
mv src/app/token/__address__ "src/app/token/[address]"
```

## Start the dev server

```bash
cd apps/web
pnpm install
pnpm dev
```

Open http://localhost:3000
