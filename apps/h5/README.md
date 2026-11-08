# DIY 设计器原型骨架

逆向自 `diy.nicen.cn/shop/32106?style=95`（分析见 `../rea-diy-nicen/REPORT.md`）。

## 运行

```bash
npm install --registry=https://registry.npmmirror.com
npm run dev
```

浏览器打开提示的地址（建议 DevTools 切手机视口）。商品模板图/贴纸来自 nicen 的线上 CDN，需联网；断网时画布为灰底但功能可用。

## 与原站的对应关系

| 原站 | 本原型 |
|---|---|
| Vue3 + Vant + pinia + Vite | 一致（无 vue-router，单页） |
| 自研 canvas 图层引擎（无 fabric/konva） | **fabric v6**（拖拽/缩放/旋转/双击编辑/序列化开箱即用） |
| 正反面画布 + 撤销/恢复 | 双 fabric.Canvas + `toJSON()` 快照栈（每面独立 50 步） |
| `X-Timestamp`/`X-Checksum`/`shop` 请求头 | axios 拦截器复刻同一算法，mock 适配器模拟"校验失败→静默空 data" |
| Mock.js 假登录 `/login` | 同样 fake 一个 `POST /login`（loadSys 与原站同构：`Promise.allSettled([login(), setup()])`） |
| `/api/v2/style?style=95` 等接口 | `src/api/mock-data.js` 内置**真实抓包 JSON**（商品/SKU/分类/素材/模板/AI 风格） |
| rrweb 会话录制 + gzip 上报 | 未实现（属埋点，非产品功能） |

## 功能清单

- 正/反面切换，各面独立撤销/恢复/清空
- 文字：颜色、字号，画布内双击编辑
- 素材：分类 chips + 分页素材（点击添加，`!thumb` 缩略图约定）
- 照片：本地文件直接上画布（dataURL，无跨域问题）
- 模板：集合 → 热门模板套用
- AI：风格列表（带使用量）→ mock generate/tasks 轮询 → 占位贴纸
- 保存：双面工程 `toJSON()` → mock `POST /api/v2/save`（控制台打印完整工程 JSON）
- 打印区域虚线参考线（对应原站 goods 画布参数）

## 已知简化

- 未实现：多选组合（fabric 原生支持，未加 UI）、图层列表面板、SKU 颜色/尺码选择、支付下单
- 接线真实后端：把 `src/api/index.js` 的 mock adapter 删掉即可（拦截器与 URL 约定已与原站一致）
