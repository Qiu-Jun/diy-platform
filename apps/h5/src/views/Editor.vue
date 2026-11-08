<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showConfirmDialog } from 'vant';
import { useEditor, CANVAS_W, CANVAS_H } from '../editor/useEditor.js';
import TextPanel from '../components/TextPanel.vue';
import MaterialPanel from '../components/MaterialPanel.vue';
import LayersPanel from '../components/LayersPanel.vue';
import PreviewDialog from '../components/PreviewDialog.vue';

const route = useRoute();
const router = useRouter();
const editor = useEditor();

const goods = ref(null); // 当前定制品类 {id,name,front,back,areaW,areaH,areaTop}
const showText = ref(false);
const showMaterial = ref(false);
const showLayers = ref(false);
const showPreview = ref(false);
const railOpen = ref(true);
const photoInput = ref(null);
const saving = ref(false);
const editingObj = ref(null); // 当前正在编辑的文字对象（null = 新建模式）

function openEdit() {
  const s = editor.selState.value;
  if (!s?.obj) return;
  editingObj.value = s.obj;
  showText.value = true;
}
watch(showText, (v) => { if (!v) editingObj.value = null; });

onBeforeUnmount(() => editor.dispose()); // 释放 fabric 画布，防止重复初始化报错

onMounted(async () => {
  // 品类：?goods=id 指定，否则取第一个
  const list = await fetch('/api/goods').then((r) => r.json()).then((j) => j.data ?? []);
  if (!list.length) {
    showToast('暂无可用品类，请先在后台「定制管理」上传');
    setTimeout(() => router.push('/'), 1200);
    return;
  }
  const gid = Number(route.query.goods);
  goods.value = list.find((g) => g.id === gid) ?? list[0];

  editor.initFace('front', document.getElementById('canvas-front'), goods.value.front, {
    w: goods.value.areaW, h: goods.value.areaH, top: goods.value.areaTop,
  });
  editor.initFace('back', document.getElementById('canvas-back'), goods.value.back, {
    w: goods.value.areaW, h: goods.value.areaH, top: goods.value.areaTop,
  });
  if (import.meta.env.DEV) window.__editor = editor; // 调试钩子

  // 携带 ?tpl=id 进入 → 加载模板二次编辑
  const tplId = tplIdFromRoute();
  if (tplId) {
    try {
      const t = await fetch('/api/templates/' + tplId).then((r) => r.json());
      await editor.loadProject(t.data);
      editor.switchFace('front'); // 打开默认正面
      showToast('已加载模板，可继续编辑');
    } catch {
      showToast('模板加载失败');
    }
  }
});

function tplIdFromRoute() {
  return route.query.tpl ? Number(route.query.tpl) : null;
}

// 保存：前脸画布截图作预览图上传，工程 JSON 入库为模板
async function onSave() {
  if (saving.value) return;
  saving.value = true;
  try {
    const dataUrl = await editor.captureFace('front', 0.5); // 预览图不含参考框等辅助元素
    const blob = await (await fetch(dataUrl)).blob();
    const fd = new FormData();
    fd.append('file', blob, 'preview.png');
    const auth = localStorage.getItem('h5_token') ? { Authorization: `Bearer ${localStorage.getItem('h5_token')}` } : {};
    const up = await fetch('/api/upload', { method: 'POST', body: fd, headers: auth }).then((r) => r.json());
    if (!up.url) throw new Error(up.message ?? '预览图上传失败');
    const payload = editor.serializeProject();
    const name = `${goods.value?.name ?? '定制'} ` + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    if (tplIdFromRoute()) {
      // 二次编辑保存：更新原模板（id 不变，旧 JSON/预览图被替换）
      await fetch('/api/templates/' + tplIdFromRoute(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ preview: up.url, data: payload }),
      });
      showToast('已保存更新');
    } else {
      // 新建：首次保存创建模板，之后本会话内保存都更新它
      const created = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ name, preview: up.url, data: payload }),
      }).then((r) => r.json());
      history.replaceState(null, '', '/editor?tpl=' + created.id); // 后续保存更新同一条
      showToast('已保存，首页模板可见');
    }
  } catch (e) {
    showToast('保存失败：' + (e.message ?? e));
  } finally {
    saving.value = false;
  }
}

function goHome() {
  router.push('/');
}

async function onClear() {
  try {
    await showConfirmDialog({ title: '清空当前面', message: '将移除该面的全部设计内容' });
  } catch { return; }
  editor.clearFace();
}

function onPhoto(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => editor.addImage(reader.result);
  reader.readAsDataURL(file);
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="goods" @click="goHome">
        <span class="back">‹</span>
        <span class="name">{{ goods?.name ?? 'DIY' }}</span>
      </div>
      <div class="actions">
        <van-button size="small" round @click="onClear">清空</van-button>
        <van-button size="small" round type="primary" :loading="saving" @click="onSave">保存</van-button>
      </div>
    </header>

    <main class="stage">
      <div class="canvas-box" v-show="editor.activeFace.value === 'front'">
        <canvas id="canvas-front" :width="CANVAS_W" :height="CANVAS_H"></canvas>
        <div v-if="editor.activeFace.value === 'front' && editor.selState.value" class="sel-bar"
             :style="{ left: editor.selState.value.cx + '%', top: editor.selState.value.top + '%' }">
          <button v-if="editor.selState.value.isText" @click="openEdit">编辑</button>
          <button class="del" @click="editor.removeSelected()">✕</button>
        </div>
      </div>
      <div class="canvas-box" v-show="editor.activeFace.value === 'back'">
        <canvas id="canvas-back" :width="CANVAS_W" :height="CANVAS_H"></canvas>
        <div v-if="editor.activeFace.value === 'back' && editor.selState.value" class="sel-bar"
             :style="{ left: editor.selState.value.cx + '%', top: editor.selState.value.top + '%' }">
          <button v-if="editor.selState.value.isText" @click="openEdit">编辑</button>
          <button class="del" @click="editor.removeSelected()">✕</button>
        </div>
      </div>

      <div class="rail" :class="{ collapsed: !railOpen }">
        <div class="rail-btn" @click="railOpen = !railOpen">{{ railOpen ? '⌃' : '⌄' }}</div>
        <template v-if="railOpen">
          <div class="rail-btn" @click="showPreview = true">预览</div>
          <div class="rail-btn" @click="showLayers = true">图层</div>
          <div class="rail-btn" @click="editor.switchFace(editor.activeFace.value === 'front' ? 'back' : 'front')">
            {{ editor.activeFace.value === 'front' ? '背面' : '正面' }}
          </div>
        </template>
      </div>
      <div class="undo-redo">
        <div class="ur" :class="{ dim: !editor.canUndo.value }" @click="editor.undo()">↶</div>
        <div class="ur" :class="{ dim: !editor.canRedo.value }" @click="editor.redo()">↷</div>
      </div>
    </main>

    <nav class="toolbar">
      <div class="tool" @click="showMaterial = true"><span class="ico">🎨</span>素材</div>
      <div class="tool" @click="showText = true"><span class="ico">🅣</span>文字</div>
      <div class="tool" @click="photoInput?.click()"><span class="ico">🖼</span>照片</div>
      <div class="tool" @click="showToast('开源版AI功能暂不支持')"><span class="ico">✨</span>AI</div>
    </nav>
    <input ref="photoInput" type="file" accept="image/*" hidden @change="onPhoto" />

    <van-overlay :show="!goods" z-index="10">
      <div class="loading-wrap"><van-loading vertical>加载品类...</van-loading></div>
    </van-overlay>

    <TextPanel v-model:show="showText" :editor="editor" :editing="editingObj" />
    <MaterialPanel v-model:show="showMaterial" :editor="editor" />
    <LayersPanel v-model:show="showLayers" :editor="editor" />
    <PreviewDialog v-model:show="showPreview" :editor="editor" />
  </div>
</template>

<style>
/* transform 使 position:fixed 的弹层/遮罩以本列（430px）为包含块，而不是整个视口 */
.page { max-width: 430px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; background: #fff; transform: translateZ(0); }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; }
.goods { display: flex; align-items: center; gap: 2px; cursor: pointer; }
.goods .back { font-size: 20px; line-height: 1; color: #333; }
.goods .name { font-size: 14px; font-weight: 600; }
.stage { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; background: #f7f7f7; }
.canvas-box { position: relative; }
.canvas-box canvas { max-width: 100%; height: auto; }
/* 选中图层头顶的浮层工具条（对应原站 编辑/✕ 悬浮按钮） */
.sel-bar { position: absolute; transform: translate(-50%, -130%); display: flex; gap: 6px; z-index: 6; pointer-events: none; white-space: nowrap; }
.sel-bar button { pointer-events: auto; height: 30px; min-width: 30px; padding: 0 10px; border-radius: 15px; border: 1px solid #eee; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.18); font-size: 12px; color: #333; cursor: pointer; }
.sel-bar button.del { padding: 0; }
.rail { position: absolute; right: 8px; top: 90px; display: flex; flex-direction: column; gap: 12px; }
.rail-btn { width: 44px; height: 44px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.12); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #333; cursor: pointer; user-select: none; }
.rail-btn.on { background: #1989fa; color: #fff; }
.rail-btn.dim { opacity: .4; }
.rail.collapsed { background: #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
/* 撤销/恢复：左下角（对齐原站） */
.undo-redo { position: absolute; left: 14px; bottom: 14px; display: flex; gap: 10px; }
.ur { width: 40px; height: 40px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.12); display: flex; align-items: center; justify-content: center; font-size: 19px; color: #333; cursor: pointer; user-select: none; }
.ur.dim { opacity: .4; }
.toolbar { display: flex; justify-content: space-around; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); border-top: 1px solid #eee; background: #fff; }
.tool { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: #333; cursor: pointer; }
.tool .ico { font-size: 20px; }
.loading-wrap { height: 100%; display: flex; align-items: center; justify-content: center; }
</style>
