<script setup>
import { ref, watch } from 'vue';

const props = defineProps({ show: Boolean, editor: Object });
const emit = defineEmits(['update:show']);

const urls = ref({ front: '', back: '' });
const swipeRef = ref(null);
const idx = ref(0);

watch(() => props.show, (v) => {
  if (!v) return;
  urls.value = props.editor.captureFacePreviews(); // 正面在前，默认展示正面
  idx.value = 0;
  swipeRef.value?.swipeTo(0);
});

function go(i) {
  idx.value = i;
  swipeRef.value?.swipeTo(i); // 桌面鼠标拖不动 Swipe，提供点击切换
}
</script>

<template>
  <van-popup :show="show" round :style="{ width: '80%' }" @update:show="(v) => emit('update:show', v)">
    <div class="title">作品预览</div>
    <div class="seg">
      <span :class="{ on: idx === 0 }" @click="go(0)">正面</span>
      <span :class="{ on: idx === 1 }" @click="go(1)">背面</span>
    </div>
    <van-swipe ref="swipeRef" :loop="false" class="swipe" @change="idx = $event">
      <van-swipe-item><img :src="urls.front" /></van-swipe-item>
      <van-swipe-item><img :src="urls.back" /></van-swipe-item>
    </van-swipe>
    <div class="btns">
      <div class="b" @click="emit('update:show', false)">关闭</div>
    </div>
  </van-popup>
</template>

<style scoped>
.title { text-align: center; font-size: 16px; font-weight: 700; padding: 20px 0 10px; }
.seg { display: flex; justify-content: center; gap: 8px; padding-bottom: 10px; }
.seg span { padding: 4px 16px; border-radius: 14px; background: #f2f2f2; font-size: 12px; cursor: pointer; }
.seg span.on { background: #111; color: #fff; }
.swipe img { width: 100%; display: block; }
.btns { border-top: 1px solid #f0f0f0; }
.b { text-align: center; padding: 13px 0; font-size: 15px; cursor: pointer; user-select: none; color: #333; }
</style>
