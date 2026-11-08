<script setup>
import { ref, watch } from 'vue';
import { showToast } from 'vant';
import { CDN } from '../config.js';

const props = defineProps({ show: Boolean, editor: Object });
const emit = defineEmits(['update:show']);

const cats = ref([]);
const activeCat = ref(null);
const assets = ref([]);
const loading = ref(false);

watch(() => props.show, async (v) => {
  if (!v || cats.value.length) return;
  const j = await fetch('/api/cats').then((r) => r.json());
  // 服务端返回 {id,label,sort}，映射成面板使用的 {value,label,sort}
  cats.value = (j.data ?? []).map((r) => ({ value: r.id, label: r.label, sort: r.sort }));
  if (cats.value.length) pick(cats.value[0]);
});

async function pick(c) {
  activeCat.value = c.value;
  loading.value = true;
  const q = new URLSearchParams({ page: '1', pageSize: '30', cat: String(c.value) });
  const j = await fetch('/api/assets?' + q).then((r) => r.json());
  assets.value = j.data ?? [];
  loading.value = false;
}

// 服务端素材（/uploads/*）同源直用；mock/CDN 素材走 /nicen 代理 + !thumb 缩略约定
function thumbSrc(a) {
  return a.url.startsWith('/uploads/') ? a.url : CDN + a.url + '!thumb';
}

async function add(a) {
  try {
    await props.editor.addImage(a.url);
    showToast('已添加素材');
  } catch (e) {
    showToast('素材插入失败：' + (e?.message ?? e));
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round :style="{ height: '62%' }" @update:show="(v) => emit('update:show', v)">
    <div class="head">
      <span class="title">素材</span>
      <van-icon name="cross" @click="emit('update:show', false)" />
    </div>
    <div class="chips">
      <span v-for="c in cats" :key="c.value" class="chip" :class="{ on: activeCat === c.value }" @click="pick(c)">{{ c.label }}</span>
    </div>
    <div v-if="!loading && !cats.length" class="empty">暂无分类，请先在后台添加分类和素材</div>
    <div v-else-if="!loading && !assets.length" class="empty">该分类暂无数据</div>
    <div v-else class="grid">
      <div v-for="a in assets" :key="a.id" class="cell" @click="add(a)">
        <img :src="thumbSrc(a)" loading="lazy" @error="$event.target.style.opacity = .15" />
      </div>
    </div>
    <van-loading v-if="loading" class="loading" />
  </van-popup>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 6px; font-weight: 600; }
.chips { display: flex; gap: 8px; padding: 8px 16px; overflow-x: auto; }
.chip { flex: none; padding: 4px 12px; border-radius: 14px; background: #f2f2f2; font-size: 12px; cursor: pointer; }
.chip.on { background: #111; color: #fff; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 16px 24px; overflow-y: auto; }
.cell { aspect-ratio: 1; background: #f7f7f7; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.cell img { max-width: 86%; max-height: 86%; }
.loading { position: absolute; left: 50%; bottom: 12px; margin-left: -15px; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 60px 0; }
</style>
