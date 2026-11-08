# diy-platform

DIY 定制平台 monorepo（pnpm workspace），逆向自 diy.nicen.cn（分析报告见 `../rea-diy-nicen/REPORT.md`）。

## 结构

```
apps/
  h5/        @diy/h5       移动端 DIY 设计器（Vue3+Vant+fabric）
  admin/     @diy/admin    管理后台（Vue3+TS+SCSS+UnoCSS+Element Plus）
  server/    @diy/server   服务端（NestJS 10，端口 4000）
packages/
  shared/    @diy/shared   共享 TS 类型（分页结构/字体/素材）
```

## 启动

```bash
pnpm install
pnpm dev:server   # NestJS http://localhost:4000
pnpm dev:admin    # 管理后台 http://localhost:5200（代理 /api、/uploads → 4000）
pnpm dev:h5       # H5 编辑器 http://localhost:5173
```

## 服务端接口

统一上传：`POST /api/upload`（multipart 字段 `file`，≤20MB）→ 落盘 `apps/server/uploads/`，静态访问 `/uploads/*`。

| 模块 | 端点 | 说明 |
|---|---|---|
| 字体 | `GET/POST /api/fonts`、`DELETE /api/fonts/:id` | ttf/otf/woff/woff2 |
| 素材分类 | `GET/POST /api/cats`、`DELETE /api/cats/:id` | |
| 素材 | `GET /api/assets?page=&pageSize=&cat=`（分页结构与 H5 端约定一致）、`POST`、`DELETE /:id` | |

持久化：**SQLite**（`apps/server/data/diy.db`，Node 22 内置 `node:sqlite`，零依赖）。表设计按 MySQL 习惯：

```sql
fonts     (id PK AI, name VARCHAR(100), url VARCHAR(255), cat VARCHAR(20), created_at)
cats      (id PK AI, label VARCHAR(50), sort INT)
assets    (id PK AI, name VARCHAR(100), url VARCHAR(255), cat INT, INDEX(cat))
templates (id PK AI, name VARCHAR(100), preview VARCHAR(255), data TEXT/JSON, created_at)
```

切 MySQL：初始化脚本已备好 `apps/server/sql/init-mysql.sql`（建库 + 同构表 + 可选账号），`pnpm add mysql2` 后把 `DbService` 里 `node:sqlite` 的调用换成 mysql2（`?` 占位符语法相同），服务层零改动。旧 db.json 数据已在首次启动时自动导入（原文件留存为 `db.json.migrated`）。

## 约定

- 上传统一走 `/api/upload`，业务表只存 `/uploads/xxx` 路径
- H5 端素材/模板分页结构与原站一致（`{total, per_page, last_page, data}`），接真实后端时把 `apps/h5/src/api/index.js` 的 mock 适配器替换为 HTTP 即可
