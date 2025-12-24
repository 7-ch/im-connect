# 部署说明

<div align="center">
  <p>
    <a href="./DEPLOY.md">English</a> | <a href="./DEPLOY_CN.md">简体中文</a>
  </p>
</div>

本指南提供了部署 IM Connect 应用程序的说明，包括数据库设置和数据填充。

## 前置要求

- Node.js (v18+)
- pnpm (推荐) 或 npm/yarn
- SQLite (或者配置的其他数据库)

## 快速开始 (自动化)

使用提供的部署脚本来自动处理依赖项安装、数据库设置和构建过程：

```bash
./scripts/deploy.sh
```

## 手动部署步骤

如果您希望手动执行部署步骤，请按照以下顺序操作：

1.  **安装依赖**
    ```bash
    pnpm install
    ```

2.  **生成 Prisma 客户端**
    ```bash
    pnpm prisma generate
    ```

3.  **数据库迁移**
    将迁移应用到生产数据库：
    ```bash
    pnpm db:deploy
    ```
    *(注意: `db:deploy` 模式严格，专为生产环境设计。在开发环境中，请使用 `pnpm db:migrate`)*

4.  **填充数据库 (可选)**
    如果是全新安装且需要初始测试数据：
    ```bash
    pnpm db:seed
    ```

5.  **构建前端**
    ```bash
    pnpm build
    ```

6.  **启动服务器**
    ```bash
    node server.js
    ```

## 可用脚本

为了方便起见，`package.json` 中添加了以下脚本：

-   `pnpm db:deploy`: 应用待处理的迁移到数据库 (生产环境安全)。
-   `pnpm db:migrate`: 创建并应用迁移 (开发环境)。
-   `pnpm db:seed`: 手动运行数据库填充脚本。
-   `pnpm db:studio`: 打开 Prisma Studio 查看/编辑数据。
