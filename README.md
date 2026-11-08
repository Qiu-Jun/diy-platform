# diy-platform

DIY 定制平台-衣服印花系统。商品定制编辑器 + 管理后台 + 服务端
***(需要定制+v  June_Qiu_0324)***

## 结构

```
apps/
  h5/        @diy/h5       移动端定制编辑器（Vue3 + Vant + fabric v6，vue-router 双页面）
  admin/     @diy/admin    管理后台（Vue3 + TS + SCSS + UnoCSS + Element Plus，含登录/RBAC）
  server/    @diy/server   服务端（NestJS 10 + node:sqlite，端口 4000）
             ├ data/       SQLite 数据库（diy.db，运行时生成）
             └ uploads/    上传文件存储（运行时生成）
packages/
  shared/    @diy/shared   共享 TS 类型（分页结构/字体/素材/品类/模板）
```

## 启动

```bash
pnpm install
pnpm dev:server   # NestJS http://localhost:4000
pnpm dev:admin    # 管理后台 http://localhost:5200（代理 /api、/uploads → 4000）
pnpm dev:h5       # H5 http://localhost:5173（代理 /api、/uploads、/nicen → 4000/cdn）
```

## H5 编辑器（/editor）

- 双面画布（正面/背面切换），fabric v6 渲染
- 印花区：按商品底图 alpha 包围盒 + 品类配置比例自动计算，元素拖出即裁剪（clipPath）
- 自定义控制点：四角旋转、四边等比拉伸（锁定比例）
- 文字：顶部输入框实时上屏，字体/样式/颜色/描边/背景/阴影六个 Tab 全实时生效
- 素材：分类 + 网格，点击插入（对接后端真实数据）
- 撤销/恢复（快照栈，每面独立 50 步）、图层面板、预览弹窗（正反面轮播）
- 保存：前脸截图作预览图 + 工程 JSON 上传入库；二次编辑同 id 更新

## H5 首页（/）

- 模板画廊（分页）+「开始定制」→ 品类选择弹窗（短袖/长袖/裙子…，来自后端定制管理）
- C 端账号密码注册/登录；「我的作品」查看/删除自己的模板
- 匿名可浏览与保存（归属为空），登录后保存自动认领归属

## 管理后台（:5200）

- 登录：账号密码 → JWT（12h），默认账号 `admin / admin123`
- 字体管理：上传 ttf/otf/woff/woff2，列表自字体预览
- 素材管理：分类 + 上传 + 网格
- 定制管理：定制品类（名称 + 正反面底图[必须] + 印花区比例 宽/高/顶边距/左边距）
- 模板管理：用户保存的工程（预览/重命名/删除）
- 用户管理 + 角色管理：RBAC 权限勾选（admin 全量 / editor 字素模定制 / viewer 只读）
- 侧栏菜单按权限渲染；写操作需登录 + 对应权限点，读接口公开（H5 匿名浏览）

## 服务端接口

统一上传：`POST /api/upload`（multipart 字段 `file`，≤20MB）→ `apps/server/uploads/`，静态访问 `/uploads/*`。

| 模块 | 端点 |
|---|---|
| 字体 | `GET/POST /api/fonts`、`DELETE /api/fonts/:id` |
| 素材分类 | `GET/POST /api/cats`、`DELETE /api/cats/:id` |
| 素材 | `GET /api/assets?page=&pageSize=&cat=`、`POST`、`DELETE /:id` |
| 定制品类 | `GET /api/goods`、`GET /:id`、`POST`、`PUT /:id`、`DELETE /:id` |
| 模板 | `GET /api/templates?page=`（列表不含大 JSON）、`GET /:id`（含 JSON）、`POST`（匿名可存）、`PUT /:id`（作者或管理权限）、`DELETE /:id` |
| 认证 | `POST /api/auth/login`、`POST /api/auth/register`（C 端自助注册）、`GET /api/auth/me` |
