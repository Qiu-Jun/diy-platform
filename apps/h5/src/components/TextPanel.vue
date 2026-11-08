<script setup>
import { reactive, ref, watch } from 'vue';
import { Shadow } from 'fabric';
import ColorPalette from './ColorPalette.vue';
import FontList from './FontList.vue';

const props = defineProps({ show: Boolean, editor: Object, editing: Object });
const emit = defineEmits(['update:show', 'created']);

const active = ref(0);
const syncing = ref(false);
const curFont = ref(null);
const st = reactive(defaults());

function defaults() {
  return {
    text: '', color: '#ffffff', fontSize: 28, fontFamily: '',
    textAlign: 'center', bold: false, italic: false, underline: false, strike: false,
    charSpacing: 0, lineHeight: 1.16,
    strokeOn: false, strokeColor: '#000000', strokeWidth: 2,
    bgOn: false, bgColor: '#ffffff',
    shadowOn: false, shadowColor: '#000000', shadowBlur: 5, shadowOffset: 3,
  };
}

// UI 状态 → fabric 属性
function fabricProps() {
  const p = {
    text: st.text.trim() || '双击编辑',
    fill: st.color,
    fontSize: st.fontSize,
    textAlign: st.textAlign,
    fontWeight: st.bold ? 'bold' : 'normal',
    fontStyle: st.italic ? 'italic' : 'normal',
    underline: st.underline,
    linethrough: st.strike,
    charSpacing: st.charSpacing,
    lineHeight: st.lineHeight,
    stroke: st.strokeOn ? st.strokeColor : null,
    strokeWidth: st.strokeOn ? st.strokeWidth : 0,
    paintFirst: st.strokeOn,
    backgroundColor: st.bgOn ? st.bgColor : '',
    shadow: st.shadowOn
      ? new Shadow({ color: st.shadowColor, blur: st.shadowBlur, offsetX: st.shadowOffset, offsetY: st.shadowOffset })
      : null,
  };
  if (st.fontFamily) p.fontFamily = st.fontFamily;
  return p;
}

// 编辑模式：打开时从选中对象反向同步
watch(() => props.show, (v) => {
  if (!v) { liveObj.value = null; return; }
  syncing.value = true;
  liveObj.value = props.editing ?? null; // 编辑目标与 App 侧 editingObj 对齐
  const o = props.editing;
  if (o) {
    const fam = String(o.get('fontFamily') ?? '');
    const m = fam.match(/f_(\d+)/);
    curFont.value = m ? { id: Number(m[1]) } : null;
    Object.assign(st, defaults(), {
      text: o.get('text') ?? '',
      color: o.get('fill') ?? '#ffffff',
      fontSize: o.get('fontSize') ?? 28,
      fontFamily: fam,
      textAlign: o.get('textAlign') ?? 'center',
      bold: o.get('fontWeight') === 'bold',
      italic: o.get('fontStyle') === 'italic',
      underline: !!o.get('underline'),
      strike: !!o.get('linethrough'),
      charSpacing: o.get('charSpacing') ?? 0,
      lineHeight: o.get('lineHeight') ?? 1.16,
      strokeOn: !!o.get('strokeWidth'),
      strokeColor: o.get('stroke') ?? '#000000',
      strokeWidth: o.get('strokeWidth') ?? 2,
      bgOn: !!o.get('backgroundColor'),
      bgColor: o.get('backgroundColor') || '#ffffff',
      shadowOn: !!o.get('shadow'),
      shadowColor: o.shadow?.color ?? '#000000',
      shadowBlur: o.shadow?.blur ?? 5,
      shadowOffset: o.shadow?.offsetX ?? 3,
    });
  } else {
    curFont.value = null;
    Object.assign(st, defaults());
  }
  active.value = 0;
  setTimeout(() => { syncing.value = false; });
});

// 实时编辑目标：编辑模式=选中对象；新建模式=首次输入/改样式时自动创建的那个对象
const liveObj = ref(null);

function ensureLive() {
  if (props.editing) return props.editing;
  if (liveObj.value) return liveObj.value;
  if (!st.text.trim()) return null; // 还没输入内容，不创建
  props.editor.addText(fabricProps());
  const o = props.editor.faces[props.editor.activeFace.value]?.value?.getActiveObject() ?? null;
  liveObj.value = o;
  if (o) emit('created', o);
  return o;
}

// 任何属性变化实时回写到画布对象（record=false 用于连续拖动，松手统一记撤销）
function apply(patch, { record = true } = {}) {
  Object.assign(st, patch);
  if (syncing.value) return;
  const o = ensureLive();
  if (o) props.editor.applyTextStyle(fabricProps(), { record });
}

// 键盘输入实时上屏（防抖；连续输入不刷撤销，失焦/完成时记一步）
let typeTimer = null;
function onTextInput() {
  if (syncing.value) return;
  clearTimeout(typeTimer);
  typeTimer = setTimeout(() => {
    const o = ensureLive();
    if (o) props.editor.applyTextStyle({ text: st.text || ' ' }, { record: false });
  }, 200);
}

// 描边/背景/阴影：色板选"无"（空串）即关闭
const onStrokeColor = (v) => apply(v ? { strokeOn: true, strokeColor: v } : { strokeOn: false });
const onBgColor = (v) => apply({ bgOn: !!v, bgColor: v || '#ffffff' });
const onShadowColor = (v) => apply(v ? { shadowOn: true, shadowColor: v } : { shadowOn: false });

function setFont(f) {
  curFont.value = f;
  apply({ fontFamily: `'f_${f.id}'` });
}

// 失焦：落地最终文本并记一步撤销（实时更新已在过程中完成）
function commit() {
  clearTimeout(typeTimer);
  const o = ensureLive();
  if (!o) return;
  props.editor.applyTextStyle(fabricProps(), { record: true });
}
</script>

<template>
  <van-popup :show="show" position="bottom" round :style="{ height: '64%' }" @update:show="(v) => emit('update:show', v)">
    <!-- 顶部常驻输入框：失焦自动插入/更新 -->
    <div class="input-bar">
      <input v-model="st.text" :placeholder="editing ? '输入文字内容' : '点击输入文案'" maxlength="60"
             @input="onTextInput" @blur="commit" @keyup.enter="$event.target.blur()" />
    </div>

    <van-tabs shrink>
      <van-tab title="字体">
        <div class="pad">
          <FontList :model-value="curFont" @select="setFont" />
        </div>
      </van-tab>

      <van-tab title="样式">
        <div class="pad">
          <div class="row-btns">
            <button class="cbtn" :class="{ on: st.textAlign === 'left' }" @click="apply({ textAlign: 'left' })">⇤</button>
            <button class="cbtn" :class="{ on: st.textAlign === 'center' }" @click="apply({ textAlign: 'center' })">≡</button>
            <button class="cbtn" :class="{ on: st.textAlign === 'right' }" @click="apply({ textAlign: 'right' })">⇥</button>
            <button class="cbtn" :class="{ on: st.bold }" @click="apply({ bold: !st.bold })"><b>B</b></button>
            <button class="cbtn" :class="{ on: st.italic }" @click="apply({ italic: !st.italic })"><i>I</i></button>
            <button class="cbtn" :class="{ on: st.underline }" @click="apply({ underline: !st.underline })"><u>U</u></button>
            <button class="cbtn" :class="{ on: st.strike }" @click="apply({ strike: !st.strike })"><s>S</s></button>
          </div>
          <div class="row">字号 {{ st.fontSize }}
            <van-slider :model-value="st.fontSize" :min="14" :max="72" style="flex:1; margin-left:12px"
                        @update:model-value="(v) => apply({ fontSize: v }, { record: false })" @change="editor.snapshotSel()" />
          </div>
          <div class="row">字间距 {{ st.charSpacing }}
            <van-slider :model-value="st.charSpacing" :min="-100" :max="800" :step="25" style="flex:1; margin-left:12px"
                        @update:model-value="(v) => apply({ charSpacing: v }, { record: false })" @change="editor.snapshotSel()" />
          </div>
          <div class="row">行间距 {{ st.lineHeight.toFixed(2) }}
            <van-slider :model-value="st.lineHeight" :min="0.8" :max="2" :step="0.02" style="flex:1; margin-left:12px"
                        @update:model-value="(v) => apply({ lineHeight: v }, { record: false })" @change="editor.snapshotSel()" />
          </div>
        </div>
      </van-tab>

      <van-tab title="颜色">
        <div class="pad">
          <ColorPalette :model-value="st.color" @update:model-value="(v) => apply({ color: v })" />
        </div>
      </van-tab>

      <van-tab title="描边">
        <div class="pad">
          <ColorPalette :model-value="st.strokeOn ? st.strokeColor : ''" allow-none @update:model-value="onStrokeColor" />
          <div v-if="st.strokeOn" class="row">粗细 {{ st.strokeWidth }}
            <van-slider :model-value="st.strokeWidth" :min="0.5" :max="8" :step="0.5" style="flex:1; margin-left:12px"
                        @update:model-value="(v) => apply({ strokeWidth: v }, { record: false })" @change="editor.snapshotSel()" />
          </div>
        </div>
      </van-tab>

      <van-tab title="背景">
        <div class="pad">
          <ColorPalette :model-value="st.bgOn ? st.bgColor : ''" allow-none @update:model-value="onBgColor" />
        </div>
      </van-tab>

      <van-tab title="阴影">
        <div class="pad">
          <ColorPalette :model-value="st.shadowOn ? st.shadowColor : ''" allow-none @update:model-value="onShadowColor" />
          <template v-if="st.shadowOn">
            <div class="row">模糊 {{ st.shadowBlur }}
              <van-slider :model-value="st.shadowBlur" :min="0" :max="20" style="flex:1; margin-left:12px"
                          @update:model-value="(v) => apply({ shadowBlur: v }, { record: false })" @change="editor.snapshotSel()" />
            </div>
            <div class="row">偏移 {{ st.shadowOffset }}
              <van-slider :model-value="st.shadowOffset" :min="0" :max="15" style="flex:1; margin-left:12px"
                          @update:model-value="(v) => apply({ shadowOffset: v }, { record: false })" @change="editor.snapshotSel()" />
            </div>
          </template>
        </div>
      </van-tab>
    </van-tabs>

    <div class="foot" />
  </van-popup>
</template>

<style scoped>
.input-bar {
  background: #1a1a1a;
  border-radius: 16px 16px 0 0;
  padding: 18px 16px 14px;
}
.input-bar input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 16px;
  caret-color: #fff;
}
.input-bar input::placeholder { color: #8a8a8a; }
.pad { padding: 12px 16px; display: flex; flex-direction: column; gap: 14px; min-height: 240px; }
.row { display: flex; align-items: center; font-size: 13px; }
.row-btns { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cbtn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #e5e5e5; background: #fff; font-size: 16px; color: #333; cursor: pointer; }
.cbtn.on { background: #1989fa; border-color: #1989fa; color: #fff; }
.foot { padding: 0 0 calc(10px + env(safe-area-inset-bottom)); }
</style>
