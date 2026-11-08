import { ref, shallowRef } from 'vue';
import { Canvas, Textbox, FabricImage, Rect, Control, Point, controlsUtils } from 'fabric';
import { CDN } from '../config.js';

export const CANVAS_W = 390;
export const CANVAS_H = 520;

// 印花区域按原站实测比例（相对衣服实际包围盒）：
// 宽≈衣服宽 44%、高≈62%、框顶≈衣服顶下方 21%、水平居中

// 背景未加载完成时的兜底框
const fallbackGuide = () => ({
  left: CANVAS_W / 2 - 90,
  top: CANVAS_H / 2 - 130,
  width: 180,
  height: 260,
});

// 扫描 alpha 通道求商品图内衣服的实际包围盒（图片四周常有透明留白）
async function computeShirtBBox(img) {
  const el = img.getElement();
  const max = 200; // 降采样扫描，精度足够
  const s = Math.min(max / el.naturalWidth, max / el.naturalHeight, 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(el.naturalWidth * s));
  c.height = Math.max(1, Math.round(el.naturalHeight * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(el, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('全透明图片');
  return {
    left: minX / s,
    top: minY / s,
    width: (maxX - minX + 1) / s,
    height: (maxY - minY + 1) / s,
  };
}

const isTextObj = (o) => /textbox|text/i.test(o?.type ?? '');

// —— 自定义控制点（对齐原站观感）：四角=旋转，四边=等比拉伸，白底蓝边圆徽章 ——
const HANDLE_BLUE = '#5b7fff';

function badgeBase(ctx) {
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = HANDLE_BLUE;
  ctx.stroke();
}

function pillBase(ctx, w, h) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2);
  else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = HANDLE_BLUE;
  ctx.stroke();
}

function glyph(ctx, char) {
  ctx.fillStyle = '#333';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 0.5);
}

const renderRotate = (ctx, left, top) => {
  ctx.save();
  ctx.translate(left, top);
  badgeBase(ctx);
  glyph(ctx, '↻');
  ctx.restore();
};

const renderScaleH = (ctx, left, top) => {
  ctx.save();
  ctx.translate(left, top);
  pillBase(ctx, 22, 14);
  glyph(ctx, '↔');
  ctx.restore();
};

const renderScaleV = (ctx, left, top) => {
  ctx.save();
  ctx.translate(left, top);
  pillBase(ctx, 14, 22);
  glyph(ctx, '↕');
  ctx.restore();
};

const rotateControl = (x, y) => new Control({
  x, y,
  sizeX: 24, sizeY: 24, touchSizeX: 34, touchSizeY: 34,
  cursorStyle: 'grab',
  actionHandler: controlsUtils.rotationWithSnapping, // 四角旋转（v6 导出名）
  render: renderRotate,
});

// 四边等比拉伸：锚点=对边中点，factor=指针到锚点距离比；缩放后重定位中心保持锚边不动
// （不使用 fabric 内建 scalingEqually——其对边中点控制点的锚定语义与预期不符）
function edgeScaleHandler(eventData, transform, x, y) {
  const o = transform.target;
  if (transform._es === undefined) {
    const b = o.getBoundingRect(); // 场景坐标（含旋转）
    const c = transform.corner;
    const anchor = c === 'mr' ? { x: b.left, y: b.top + b.height / 2 }
      : c === 'ml' ? { x: b.left + b.width, y: b.top + b.height / 2 }
      : c === 'mb' ? { x: b.left + b.width / 2, y: b.top }
      : { x: b.left + b.width / 2, y: b.top + b.height };
    transform._es = {
      anchor,
      d0: Math.max(8, Math.hypot(x - anchor.x, y - anchor.y)),
      sx0: o.scaleX, sy0: o.scaleY, c0: o.getCenterPoint(),
    };
  }
  const { anchor, d0, sx0, sy0, c0 } = transform._es;
  const f = Math.max(0.05, Math.hypot(x - anchor.x, y - anchor.y) / d0);
  if (import.meta.env.DEV && window.__flog) window.__flog.push({ f: +f.toFixed(3), anchor: { x: Math.round(anchor.x), y: Math.round(anchor.y) }, x: Math.round(x), y: Math.round(y), d0: Math.round(d0) });
  o.set({ scaleX: sx0 * f, scaleY: sy0 * f });
  const cn = { x: anchor.x + (c0.x - anchor.x) * f, y: anchor.y + (c0.y - anchor.y) * f };
  o.setPositionByOrigin(new Point(cn.x, cn.y), 'center', 'center');
  o.setCoords();
  return true;
}

const scaleControl = (x, y, dir) => new Control({
  x, y,
  sizeX: 22, sizeY: 22, touchSizeX: 32, touchSizeY: 32,
  cursorStyle: dir === 'h' ? 'ew-resize' : 'ns-resize',
  actionHandler: edgeScaleHandler,
  render: dir === 'h' ? renderScaleH : renderScaleV,
});

// 四角旋转 + 四边等比拉伸（替换 fabric 默认的方块控制点，去掉顶部旋转柄）
function niceControls() {
  return {
    tl: rotateControl(-0.5, -0.5),
    tr: rotateControl(0.5, -0.5),
    bl: rotateControl(-0.5, 0.5),
    br: rotateControl(0.5, 0.5),
    ml: scaleControl(-0.5, 0, 'h'),
    mr: scaleControl(0.5, 0, 'h'),
    mt: scaleControl(0, -0.5, 'v'),
    mb: scaleControl(0, 0.5, 'v'),
  };
}

function applyControls(obj) {
  if (!obj || obj.excludeFromExport) return;
  obj.controls = niceControls();
}

// 原站同款：设计元素超出印花区被「范围」遮罩裁掉（clip:!0, blendMode:"destination-in"）。
// fabric 用 absolutePositioned clipPath 实现画布坐标系裁剪
function clipFor(g) {
  return new Rect({ left: g.left, top: g.top, width: g.width, height: g.height, absolutePositioned: true });
}

export function useEditor() {
  const faces = { front: shallowRef(null), back: shallowRef(null) };
  const activeFace = ref('front');
  const canUndo = ref(false);
  const canRedo = ref(false);
  const selState = shallowRef(null); // {obj, isText, cx(%), top(%)} 供浮层工具条使用
  const layerVersion = ref(0); // 图层列表变更计数（驱动图层面板刷新）
  const viewZoom = ref(1); // 画布视口倍数（双指捏合动态变化，复位恢复 1）
  const undoStacks = { front: [], back: [] };
  const redoStacks = { front: [], back: [] };
  const guideRects = { front: null, back: null }; // 每面印花区（跟随商品图计算）
  const guideObjs = { front: null, back: null };  // 每面印花框实例（loadFromJSON 会清掉，需重挂）
  const areaCfg = { front: null, back: null };    // 每面印花区比例（品类配置）
  let restoring = false;
  let pinch = null; // 双指捏合手势状态

  function face() { return faces[activeFace.value].value; }
  function getGuide(name = activeFace.value) { return guideRects[name] ?? fallbackGuide(); }

  function refreshFlags() {
    const f = activeFace.value;
    canUndo.value = undoStacks[f].length >= 2; // 栈顶是当前状态，至少要有上一个状态才可撤销
    canRedo.value = redoStacks[f].length > 0;
  }

  // 显式按面记快照（事件回调传入所属面，避免背面初始化时误记到正面栈）
  function snapshot(name = activeFace.value) {
    if (restoring) return;
    const c = faces[name]?.value;
    if (!c) return;
    undoStacks[name].push(JSON.stringify(c.toJSON()));
    if (undoStacks[name].length > 50) undoStacks[name].shift();
    redoStacks[name].length = 0;
    refreshFlags();
  }

  // 选中态 → 场景坐标换算成画布盒百分比，供浮层工具条定位
  function refreshSel(canvas) {
    const c = canvas ?? face();
    if (!c) { selState.value = null; return; }
    const o = c.getActiveObject();
    if (!o || o.excludeFromExport) { selState.value = null; return; }
    const r = o.getBoundingRect();
    selState.value = {
      obj: o,
      isText: isTextObj(o),
      cx: Math.min(Math.max(((r.left + r.width / 2) / CANVAS_W) * 100, 14), 86),
      top: Math.max((r.top / CANVAS_H) * 100, 9),
    };
  }

  function bindCanvas(canvas, name) {
    canvas.on({
      'object:added': () => { snapshot(name); layerVersion.value++; },
      'object:modified': () => snapshot(name),
      'object:removed': () => { snapshot(name); layerVersion.value++; },
      'selection:created': () => refreshSel(canvas),
      'selection:updated': () => refreshSel(canvas),
      'selection:cleared': () => refreshSel(canvas),
      'object:moving': () => refreshSel(canvas),
      'object:scaling': () => refreshSel(canvas),
      'object:rotating': () => refreshSel(canvas),
    });
  }

  function makeCanvas(name, el, modelUrl, area) {
    const canvas = new Canvas(el, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#f5f5f5',
      preserveObjectStacking: true,
      selection: true,
    });

    const guide = new Rect({
      left: 0, top: 0, width: 0, height: 0,
      fill: 'rgba(91,127,255,0.02)',
      stroke: '#5b7fff',
      strokeDashArray: [6, 4],
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      visible: false,
    });
    canvas.add(guide);
    guideObjs[name] = guide;
    areaCfg[name] = area ?? null;

    if (modelUrl) {
      loadBg(canvas, name, guide, modelUrl, area);
    } else {
      const rect = fallbackGuide();
      guide.set({ ...rect, visible: true });
      guideRects[name] = rect;
    }

    return canvas;
  }

  // 依据当前背景图（衣服）包围盒 + 品类印花区比例与水平位置，计算印花区矩形
  async function computeGuideRect(name) {
    const canvas = faces[name].value;
    const bg = canvas?.backgroundImage;
    const a = areaCfg[name] ?? { w: 44, h: 62, top: 21, left: null };
    if (!bg) return fallbackGuide();
    const bLeft = bg.left, bTop = bg.top;
    const nb = await computeShirtBBox(bg).catch(() => null);
    // 水平位置：areaLeft = 印花区左边缘相对衣服包围盒的偏移 %；空 = 水平居中
    const leftOf = (sbLeft, sbw, gw) =>
      a.left === null || a.left === undefined ? sbLeft + (sbw - gw) / 2 : sbLeft + sbw * (a.left / 100);
    if (nb) {
      // 衣服实际包围盒（场景坐标）= 自然坐标 × 绘制 scale
      const sbw = nb.width * bg.scaleX;
      const sbh = nb.height * bg.scaleY;
      const sbLeft = bLeft + nb.left * bg.scaleX;
      const sbTop = bTop + nb.top * bg.scaleY;
      const gw = sbw * (a.w / 100);
      const gh = sbh * (a.h / 100);
      return { left: leftOf(sbLeft, sbw, gw), top: sbTop + sbh * (a.top / 100), width: gw, height: gh };
    }
    const iw = bg.width * bg.scaleX;
    const ih = bg.height * bg.scaleY;
    const gw = iw * (a.w / 100);
    const gh = ih * (a.h / 100);
    return { left: leftOf(bLeft, iw, gw), top: bTop + (ih - gh) / 2, width: gw, height: gh };
  }

  async function loadBg(canvas, name, guide, modelUrl, area) {
    try {
      const img = await loadFabricImage(modelUrl);
      // 优先按衣服实际包围盒缩放定位（衣服放大到占画布 94%，短边留 6% 边距）；
      // 拿不到 bbox 时退化为整图适配
      // 注意 bbox 是图片自然像素坐标，需乘绘制 scale 转成画布场景坐标
      const nb = await computeShirtBBox(img).catch(() => null);
      if (nb) {
        const scale = Math.min((CANVAS_W * 0.94) / nb.width, (CANVAS_H * 0.94) / nb.height);
        img.scale(scale);
        // 衣服包围盒中心对齐画布中心
        img.set({
          left: CANVAS_W / 2 - (nb.left + nb.width / 2) * scale,
          top: CANVAS_H / 2 - (nb.top + nb.height / 2) * scale,
        });
      } else {
        const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height) * 0.96;
        img.scale(scale);
        img.set({ left: (CANVAS_W - img.width * scale) / 2, top: (CANVAS_H - img.height * scale) / 2 });
      }
      canvas.backgroundImage = img;
      const rect = await computeGuideRect(name);
      guide.set({ ...rect, visible: true });
      guideRects[name] = rect;
      guide.setCoords();
      canvas.requestRenderAll();
      snapshot(name); // 背景就绪后的状态即该面的初始历史状态
    } catch {
      const rect = fallbackGuide();
      guide.set({ ...rect, visible: true });
      guideRects[name] = rect;
      canvas.requestRenderAll();
      snapshot(name);
    }
  }

  async function loadFabricImage(url) {
    try {
      return await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    } catch {
      return await FabricImage.fromURL(url); // 同源代理仍失败时降级
    }
  }

  // 路由离开/组件卸载时销毁 fabric 实例，否则重挂会报 "already been initialized"
  function dispose() {
    for (const name of ['front', 'back']) {
      faces[name]?.value?.dispose();
      faces[name].value = null;
    }
  }

  function initFace(name, el, modelUrl, area) {
    if (faces[name].value) return;
    const canvas = makeCanvas(name, el, modelUrl, area);
    faces[name].value = canvas;
    bindCanvas(canvas, name);
    attachPinch(canvas, el);
    refreshFlags();
  }

  // 双指捏合缩放画布视口（倍数动态：指尖距离比 × 起始倍数，0.5~5）。
  // 在容器捕获阶段拦截双指事件，避免 fabric 把它当成"缩放选中对象"。
  function attachPinch(canvas, el) {
    const box = el.parentElement ?? el;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const rect = () => canvas.upperCanvasEl.getBoundingClientRect();
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2) { pinch = null; return; }
      e.preventDefault();
      e.stopPropagation();
      const r = rect();
      pinch = {
        d0: Math.max(1, dist(e.touches)),
        z0: canvas.getZoom(),
        m0: new Point((e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
                      (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top),
      };
    }, { capture: true, passive: false });

    box.addEventListener('touchmove', (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const r = rect();
      const z = Math.min(5, Math.max(0.5, pinch.z0 * dist(e.touches) / pinch.d0));
      const m = new Point((e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
                          (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top);
      canvas.zoomToPoint(m, z); // 以两指中点为焦点，移动中点可自然平移
      viewZoom.value = z;
      canvas.requestRenderAll();
    }, { capture: true, passive: false });

    box.addEventListener('touchend', () => {
      if (pinch) {
        pinch = null;
        canvas.getObjects().forEach((o) => o.setCoords()); // v6 无 canvas.setCoords
      }
    }, { capture: true });
  }

  // 复位：视口恢复 1 倍、无平移
  function resetView() {
    const canvas = face();
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    viewZoom.value = 1;
    canvas.requestRenderAll();
  }

  function switchFace(name) {
    if (!faces[name].value) return;
    activeFace.value = name;
    const guide = guideObjs[name];
    if (guide) guide.visible = true;
    refreshSel();
    refreshFlags();
    faces[name].value.requestRenderAll();
  }

  // 截取某一面成品图：临时隐藏参考框/选中态（辅助元素不进图），完成后恢复现场
  async function captureFace(name, multiplier = 1) {
    const canvas = faces[name].value;
    if (!canvas) return '';
    const guide = guideObjs[name];
    const active = canvas.getActiveObject();
    canvas.discardActiveObject();
    if (guide) guide.visible = false;
    canvas.requestRenderAll();
    const url = canvas.toDataURL({ format: 'png', multiplier });
    if (guide) guide.visible = true;
    if (active) canvas.setActiveObject(active);
    canvas.requestRenderAll();
    return url;
  }

  // 预览弹窗用：正反两面成品图
  async function captureFacePreviews() {
    return { front: await captureFace('front'), back: await captureFace('back') };
  }

  // —— 图层操作 ——
  function layerList() {
    return face()?.getObjects().filter((o) => !o.excludeFromExport).reverse() ?? []; // 最上层在前
  }
  function layerLabel(o) {
    if (isTextObj(o)) return String(o.get('text') ?? '文字').slice(0, 12);
    return '素材图';
  }
  function moveLayer(o, dir) {
    const canvas = face();
    if (!canvas || !o) return;
    if (dir === 1) canvas.bringObjectForward(o); else canvas.sendObjectBackwards(o);
    canvas.requestRenderAll();
    snapshot(); // 层序变化计入撤销
    layerVersion.value++;
  }
  function removeLayer(o) {
    const canvas = face();
    if (!canvas || !o) return;
    canvas.discardActiveObject();
    canvas.remove(o);
  }
  function selectLayer(o) {
    const canvas = face();
    if (!canvas || !o) return;
    canvas.setActiveObject(o);
    refreshSel(canvas);
    canvas.requestRenderAll();
  }

  async function restore(json) {
    const f = activeFace.value;
    const canvas = faces[f].value;
    restoring = true;
    await canvas.loadFromJSON(json);
    // 印花框 excludeFromExport 不进 JSON，loadFromJSON 会把它清掉 —— 重新挂回并置底
    const guide = guideObjs[f];
    if (guide && !canvas.getObjects().includes(guide)) {
      canvas.add(guide);
      canvas.sendObjectToBack(guide);
    }
    // controls 是实例属性不随 JSON 序列化 —— 恢复后重新挂自定义控制点
    canvas.getObjects().forEach(applyControls);
    canvas.requestRenderAll();
    restoring = false;
  }

  // 栈里存的是"每次变更后"的状态，栈顶 == 当前状态
  // undo = 把栈顶移入 redo 栈，恢复新的栈顶（即上一个状态）
  async function undo() {
    const f = activeFace.value;
    if (undoStacks[f].length < 2) return;
    redoStacks[f].push(undoStacks[f].pop());
    await restore(undoStacks[f][undoStacks[f].length - 1]);
    refreshFlags();
    refreshSel();
  }

  async function redo() {
    const f = activeFace.value;
    if (!redoStacks[f].length) return;
    const next = redoStacks[f].pop();
    undoStacks[f].push(next);
    await restore(next);
    refreshFlags();
    refreshSel();
  }

  function addText(props = {}) {
    const canvas = face();
    const g = getGuide();
    const { text = '双击编辑', ...style } = props;
    const t = new Textbox(text, {
      left: g.left + 20,
      top: g.top + g.height * 0.25,
      width: g.width - 40,
      textAlign: 'center',
      ...style,
      clipPath: clipFor(g),
    });
    applyControls(t);
    canvas.add(t);
    canvas.setActiveObject(t);
    refreshSel(canvas); // 程序化选中不触发事件，手动刷新浮层工具条
  }

  async function addImage(url) {
    const canvas = face();
    const g = getGuide();
    // 服务端 uploads / http(s) / 本地 dataURL 原样使用；其余相对路径补 CDN 前缀
    const src = /^https?:|^data:|^\/uploads\//i.test(url) ? url : CDN + url;
    const img = await loadFabricImage(src);
    const scale = Math.min((g.width * 0.8) / img.width, (g.height * 0.8) / img.height, 1);
    img.scale(scale);
    img.set({
      left: g.left + (g.width - img.width * scale) / 2,
      top: g.top + (g.height - img.height * scale) / 2,
      clipPath: clipFor(g),
    });
    applyControls(img);
    canvas.add(img);
    canvas.setActiveObject(img);
    refreshSel(canvas);
  }

  // 文字样式实时回写（面板 编辑模式 每次改动调用）
  // record=false 用于滑杆拖动过程（由 @change 时的 snapshotSel() 统一记一步撤销）
  function applyTextStyle(props, { record = true } = {}) {
    const canvas = face();
    const o = canvas?.getActiveObject();
    if (!isTextObj(o)) return false;
    o.set(props);
    canvas.requestRenderAll();
    if (record) snapshot();
    refreshSel(canvas);
    return true;
  }

  function snapshotSel() {
    if (face()?.getActiveObject()) snapshot();
  }

  function removeSelected() {
    const canvas = face();
    const objs = canvas.getActiveObjects();
    if (!objs.length) return false;
    canvas.discardActiveObject();
    canvas.remove(...objs);
    return true;
  }

  function clearFace() {
    const canvas = face();
    canvas.discardActiveObject();
    canvas.remove(...canvas.getObjects().filter((o) => !o.excludeFromExport));
  }

  // 加载模板工程（双面 JSON），重置该面撤销历史
  async function loadProject(project) {
    for (const name of ['front', 'back']) {
      const canvas = faces[name].value;
      const json = project?.faces?.[name];
      if (!canvas || !json) continue;
      restoring = true;
      await canvas.loadFromJSON(json);
      const guide = guideObjs[name];
      if (guide && !canvas.getObjects().includes(guide)) {
        canvas.add(guide);
        canvas.sendObjectToBack(guide);
      }
      canvas.getObjects().forEach(applyControls);
      // 模板 JSON 不含参考框 —— 依据模板自身底图 + 当前品类比例重算印花区
      const rect = await computeGuideRect(name);
      if (guide) { guide.set({ ...rect, visible: true }); guideRects[name] = rect; guide.setCoords(); }
      undoStacks[name] = [JSON.stringify(canvas.toJSON())];
      redoStacks[name] = [];
      restoring = false;
      canvas.requestRenderAll();
    }
    refreshFlags();
    refreshSel();
  }

  function serializeProject() {
    return {
      version: '0.1',
      shop: 32106,
      style: 95,
      faces: {
        front: faces.front.value?.toJSON() ?? null,
        back: faces.back.value?.toJSON() ?? null,
      },
      savedAt: new Date().toISOString(),
    };
  }

  return {
    faces, activeFace, canUndo, canRedo, selState,
    layerVersion, viewZoom,
    initFace, switchFace, loadProject, captureFacePreviews, captureFace, resetView, dispose,
    layerList, layerLabel, moveLayer, removeLayer, selectLayer,
    addText, addImage, applyTextStyle, snapshotSel, removeSelected, clearFace,
    undo, redo, serializeProject,
    undoStacks, redoStacks, guideObjs, guideRects, // 调试用
  };
}
