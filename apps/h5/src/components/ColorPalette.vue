<script setup>
// 公用色板：颜色/描边/背景/阴影 共用（描边、背景、阴影 allowNone 显示"无"格）
defineProps({ modelValue: String, allowNone: Boolean });
const emit = defineEmits(['update:modelValue']);

const COLORS = [
  '#ffffff', '#fdfce8', '#ffff00', '#f0e68c', '#ffee58', '#ffe600', '#ffcc00', '#ffe0b2',
  '#ffe4b5', '#ffd700', '#ffc0cb', '#ffb6c1', '#ff9f43', '#ff7f50', '#ff8c00', '#ff6600',
  '#ff6347', '#ff69b4', '#fa8072', '#ff4500', '#ff0000', '#f5f5dc', '#fffacd', '#daa520',
  '#ffa07a', '#fff5ee', '#dc143c', '#ff1493', '#f0fff0', '#eee8aa', '#f08080', '#e9967a',
  '#d3d3d3', '#deb887', '#dda0dd', '#e91e63', '#b8860b', '#c0c0c0', '#ff00ff', '#d2b48c',
  '#d2691e', '#b22222', '#bc8f8f', '#ba55d3', '#bdb76b', '#add8e6', '#7cfc00', '#a9a9a9',
  '#8b4513', '#800000', '#9400d3', '#6b8e23', '#4b0082', '#7b68ee', '#87ceeb', '#20b2aa',
];
</script>

<template>
  <div class="palette">
    <div v-if="allowNone" class="cell" :class="{ on: !modelValue }" @click="emit('update:modelValue', '')">
      <span class="none-stripe" />
    </div>
    <div v-for="c in COLORS" :key="c" class="cell" :class="{ on: modelValue === c }"
         :style="{ background: c }" @click="emit('update:modelValue', c)" />
  </div>
</template>

<style scoped>
.palette { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; padding: 4px 2px; }
.cell { aspect-ratio: 1; border-radius: 50%; border: 1px solid #e2e2e2; cursor: pointer; position: relative; }
.cell.on { border-color: #1989fa; box-shadow: 0 0 0 2px rgba(25, 137, 250, .3); }
.none-stripe { position: absolute; inset: 5px; border-radius: 50%;
  background: repeating-linear-gradient(45deg, #c8c8c8 0 2px, #fff 2px 6px); }
</style>
