<script setup>
// 字体列表：服务端 /api/fonts，自字体渲染，右侧下载图标
import { onMounted, ref } from 'vue';
import { showToast } from 'vant';

const props = defineProps({ modelValue: Object }); // 选中的字体行 {id,name,url,cat}
const emit = defineEmits(['select']);

const fonts = ref([]);
const loadingId = ref(null); // 正在下载字体的 id（行内转圈）
const ready = ref(new Set()); // 已就绪（FontFace 已注册）的字体 id

const filtered = ref([]);

// 就绪判断用自维护的 ready 注册表。
// 不能用 document.fonts.check()：未注册的字体 check 恒为 true（无匹配即通过），永远走不到 loading 分支
const pending = new Map(); // 去重：预载与点击并发时只下载一次

async function register(f) {
  if (pending.has(f.id)) return pending.get(f.id);
  const p = (async () => {
    try {
      const face = new FontFace(`f_${f.id}`, `url(${f.url})`);
      await face.load();
      document.fonts.add(face);
      ready.value.add(f.id);
      return true;
    } catch {
      showToast(`字体「${f.name}」下载失败`);
      return false;
    } finally {
      pending.delete(f.id);
    }
  })();
  pending.set(f.id, p);
  return p;
}

// 点击行：未就绪的先下载（行内 loading），完成后应用到画布
async function choose(f) {
  if (loadingId.value !== null) return;
  if (!ready.value.has(f.id)) {
    loadingId.value = f.id;
    const ok = await register(f);
    loadingId.value = null;
    if (!ok) return;
  }
  emit('select', f);
}

onMounted(async () => {
  try {
    fonts.value = (await fetch('/api/fonts').then((r) => r.json())).data ?? [];
    filtered.value = fonts.value;
    // 后台逐个预载（列表里的自字体预览会随下载就绪逐渐生效）
    (async () => { for (const f of fonts.value) await register(f); })();
  } catch { /* 服务端不可用时列表为空 */ }
});
</script>

<template>
  <div>
    <div class="fgrid">
      <div v-for="f in filtered" :key="f.id" class="fitem" :class="{ on: modelValue?.id === f.id }" @click="choose(f)">
        <span class="fname" :style="{ fontFamily: `'f_${f.id}'` }">{{ f.name }}</span>
        <van-loading v-if="loadingId === f.id" size="16" class="dl" />
        <a v-else class="dl" :href="f.url" download title="下载字体" @click.stop>↓</a>
      </div>
      <div v-if="!filtered.length" class="empty">该分类暂无字体</div>
    </div>
  </div>
</template>

<style scoped>
.fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-height: 300px; overflow-y: auto; }
.fitem { position: relative; background: #f5f5f5; border-radius: 8px; padding: 14px 12px; display: flex;
  align-items: center; justify-content: space-between; cursor: pointer; }
.fitem.on { outline: 2px solid #1989fa; }
.fname { font-size: 17px; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl { width: 22px; height: 22px; border-radius: 50%; background: #e8e8e8; color: #666; font-size: 13px;
  display: flex; align-items: center; justify-content: center; flex: none; text-decoration: none; }
.empty { grid-column: 1 / -1; text-align: center; color: #999; font-size: 12px; padding: 24px 0; }
</style>
