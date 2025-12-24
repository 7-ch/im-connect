# Deployment Instructions

<div align="center">
  <p>
    <a href="./DEPLOY.md">English</a> | <a href="./DEPLOY_CN.md">简体中文</a>
  </p>
</div>


This guide provides instructions for deploying the AN-IM application, including database setup and seeding.

## Prerequisites

- Node.js (v18+)
- pnpm (recommended) or npm/yarn
- SQLite (or other database if configured)

## Quick Start (Automated)

Use the provided deployment script to handle dependencies, database setup, and building:

```bash
./scripts/deploy.sh
```

## Manual Deployment Steps

If you prefer to run steps manually, follow this sequence:

1.  **Install Dependencies**
    ```bash
    pnpm install
    ```

2.  **Generate Prisma Client**
    ```bash
    pnpm prisma generate
    ```

3.  **Database Migration**
    Apply migrations to the production database:
    ```bash
    pnpm db:deploy
    ```
    *(Note: `db:deploy` is strict and meant for production. For development, use `pnpm db:migrate`)*

4.  **Seed Database (Optional)**
    If this is a fresh install and you need initial data:
    ```bash
    pnpm db:seed
    ```

5.  **Build Frontend**
    ```bash
    pnpm build
    ```

6.  **Start Server**
    ```bash
    node server.js
    ```

## Available Scripts

The following scripts have been added to `package.json` for convenience:

-   `pnpm db:deploy`: Apply pending migrations to the database (Production safe).
-   `pnpm db:migrate`: Create and apply migrations (Development).
-   `pnpm db:seed`: Run the database seeder manually.
-   `pnpm db:studio`: Open Prisma Studio to view/edit data.
