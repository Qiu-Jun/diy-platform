<script setup>
import { computed } from 'vue';
import { showToast } from 'vant';

const props = defineProps({ show: Boolean, editor: Object });
const emit = defineEmits(['update:show']);

// layerVersion 变化时重算（新增/删除/层序/改动）
const rows = computed(() => {
  props.editor.layerVersion.value; // 依赖收集
  if (!props.show) return [];
  return props.editor.layerList().map((o, i) => ({
    o,
    idx: i,
    label: props.editor.layerLabel(o),
    isText: /textbox|text/i.test(o.type ?? ''),
  }));
});

function select(r) {
  props.editor.selectLayer(r.o);
  showToast('已选中该图层');
}
function up(r) { props.editor.moveLayer(r.o, 1); }
function down(r) { props.editor.moveLayer(r.o, -1); }
function del(r) {
  props.editor.removeLayer(r.o);
  showToast('已删除');
}
</script>

<template>
  <van-popup :show="show" position="bottom" round :style="{ height: '50%' }" @update:show="(v) => emit('update:show', v)">
    <div class="head">
      <span class="title">图层（{{ rows.length }}）</span>
      <van-icon name="cross" @click="emit('update:show', false)" />
    </div>
    <div class="list">
      <div v-for="r in rows" :key="r.o.__uid ?? r.idx" class="row" @click="select(r)">
        <span class="tag">{{ r.isText ? '文字' : '图片' }}</span>
        <span class="label">{{ r.label }}</span>
        <span class="ops">
          <button class="op" title="上移一层" @click.stop="up(r)">↑</button>
          <button class="op" title="下移一层" @click.stop="down(r)">↓</button>
          <button class="op del" title="删除" @click.stop="del(r)">✕</button>
        </span>
      </div>
      <div v-if="!rows.length" class="empty">当前面还没有图层</div>
    </div>
  </van-popup>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 8px; font-weight: 600; }
.list { padding: 4px 16px 24px; overflow-y: auto; }
.row { display: flex; align-items: center; gap: 10px; background: #f5f5f5; border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; }
.tag { flex: none; font-size: 11px; color: #1989fa; background: rgba(25,137,250,.1); border-radius: 4px; padding: 2px 6px; }
.label { flex: 1; font-size: 14px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops { display: flex; gap: 6px; }
.op { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e2e2e2; background: #fff; font-size: 13px; color: #333; cursor: pointer; }
.op.del { color: #ee0a24; border-color: #f3c3ca; }
.empty { text-align: center; color: #999; font-size: 12px; padding: 30px 0; }
</style>
