<script setup lang="ts">
// 可视化印花区编辑器：底图 + 可拖动/拉伸的印花框，自动换算成相对衣服包围盒的百分比
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps<{ src: string; area: { areaW: number; areaH: number; areaTop: number; areaLeft?: number | null } }>();
const emit = defineEmits<{ (e: 'change', a: { areaW: number; areaH: number; areaTop: number; areaLeft: number | null }): void }>();

const imgEl = ref<HTMLImageElement>();
const boxEl = ref<HTMLDivElement>();
const rect = ref({ x: 0, y: 0, w: 0, h: 0 });      // 印花框（显示像素）
const shirt = ref({ x: 0, y: 0, w: 1, h: 1 });      // 衣服包围盒（显示像素）
const ready = ref(false);
let drag: { mode: 'move' | 'size'; px: number; py: number; start: typeof rect.value } | null = null;

// alpha 扫描求衣服实际包围盒（自然像素坐标）
function alphaBBox(img: HTMLImageElement) {
  const s = Math.min(200 / img.naturalWidth, 200 / img.naturalHeight, 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width: img.naturalWidth, height: img.naturalHeight };
  return { left: minX / s, top: minY / s, width: (maxX - minX + 1) / s, height: (maxY - minY + 1) / s };
}

// 按area比例把印花框摆到显示坐标
function layoutFromArea() {
  const el = imgEl.value, box = boxEl.value;
  if (!el || !box || !el.naturalWidth) return;
  const ds = el.clientWidth / el.naturalWidth;
  const nb = alphaBBox(el);
  shirt.value = { x: nb.left * ds, y: nb.top * ds, w: nb.width * ds, h: nb.height * ds };
  const s = shirt.value, a = props.area;
  const leftPct = a.areaLeft ?? (100 - a.areaW) / 2; // 未设置则水平居中
  rect.value = {
    x: s.x + s.w * leftPct / 100,
    y: s.y + s.h * a.areaTop / 100,
    w: s.w * a.areaW / 100,
    h: s.h * a.areaH / 100,
  };
  ready.value = true;
}

function emitArea() {
  const s = shirt.value, r = rect.value;
  emit('change', {
    areaW: +((r.w / s.w) * 100).toFixed(1),
    areaH: +((r.h / s.h) * 100).toFixed(1),
    areaTop: +(((r.y - s.y) / s.h) * 100).toFixed(1),
    areaLeft: +(((r.x - s.x) / s.w) * 100).toFixed(1),
  });
}

function startMove(e: PointerEvent) {
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  drag = { mode: 'move', px: e.clientX, py: e.clientY, start: { ...rect.value } };
}
function startSize(e: PointerEvent) {
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  drag = { mode: 'size', px: e.clientX, py: e.clientY, start: { ...rect.value } };
}
function onMove(e: PointerEvent) {
  if (!drag) return;
  const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
  const s = shirt.value, r0 = drag.start;
  if (drag.mode === 'move') {
    rect.value = {
      ...r0,
      x: Math.min(Math.max(r0.x + dx, s.x), s.x + s.w - r0.w),
      y: Math.min(Math.max(r0.y + dy, s.y), s.y + s.h - r0.h),
    };
  } else {
    rect.value = {
      ...r0,
      w: Math.max(20, Math.min(r0.w + dx, s.x + s.w - r0.x)),
      h: Math.max(20, Math.min(r0.h + dy, s.y + s.h - r0.y)),
    };
  }
  emitArea();
}
function endDrag() { drag = null; }

watch(() => props.src, async () => { ready.value = false; await nextTick(); });
watch([() => props.area.areaW, () => props.area.areaH, () => props.area.areaTop, () => props.area.areaLeft], () => {
  if (!drag) layoutFromArea(); // 外部数字微调时同步框位置
});
onMounted(async () => { await nextTick(); if (imgEl.value?.complete) layoutFromArea(); });
</script>

<template>
  <div>
    <div ref="boxEl" class="relative inline-block max-w-full select-none">
      <img ref="imgEl" :src="src" class="max-w-full block" @load="() => { ready = false; nextTick(() => layoutFromArea()); }" draggable="false" />
      <template v-if="ready">
        <div class="area-rect" :style="{ left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' }"
             @pointerdown="startMove" @pointermove="onMove" @pointerup="endDrag" />
        <span class="area-handle" :style="{ left: rect.x + rect.w - 7 + 'px', top: rect.y + rect.h - 7 + 'px' }"
              @pointerdown="startSize" @pointermove="onMove" @pointerup="endDrag" />
      </template>
    </div>
    <div class="text-xs text-gray-400 mt-1">拖动虚线框调整印花位置，右下角圆点拉伸大小</div>
  </div>
</template>

<style scoped>
.area-rect {
  position: absolute;
  border: 2px dashed #1989fa;
  background: rgba(25, 137, 250, 0.06);
  cursor: move;
  box-sizing: border-box;
}
.area-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1989fa;
  border: 2px solid #fff;
  cursor: nwse-resize;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
</style>
