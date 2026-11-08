<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, uploadFile } from '../api/http';
import AreaPicker from '../components/AreaPicker.vue';

interface GoodsRow {
  id: number; name: string; front: string; back: string;
  areaW: number; areaH: number; areaTop: number;
}

const list = ref<GoodsRow[]>([]);
const dialog = ref(false);
const submitting = ref(false);
const editId = ref<number | null>(null); // null=新增
const form = ref({ name: '', front: '', back: '', areaW: 44, areaH: 62, areaTop: 21, areaLeft: 28 as number | null });
const frontUploading = ref(false);
const backUploading = ref(false);

async function load() {
  list.value = (await api.get<{ data: GoodsRow[] }>('/goods')).data;
}

function openAdd() {
  editId.value = null;
  form.value = { name: '', front: '', back: '', areaW: 44, areaH: 62, areaTop: 21, areaLeft: 28 };
  dialog.value = true;
}

function openEdit(row: GoodsRow) {
  editId.value = row.id;
  form.value = { name: row.name, front: row.front, back: row.back, areaW: row.areaW, areaH: row.areaH, areaTop: row.areaTop, areaLeft: row.areaLeft };
  dialog.value = true;
}

async function onFront(file: File) {
  frontUploading.value = true;
  try {
    form.value.front = (await uploadFile(file)).url;
    ElMessage.success('正面底图已上传');
  } finally {
    frontUploading.value = false;
  }
}

async function onBack(file: File) {
  backUploading.value = true;
  try {
    form.value.back = (await uploadFile(file)).url;
    ElMessage.success('反面底图已上传');
  } finally {
    backUploading.value = false;
  }
}

// AreaPicker 拖动/拉伸后回填比例
function applyArea(a: { areaW: number; areaH: number; areaTop: number; areaLeft: number | null }) {
  form.value.areaW = a.areaW;
  form.value.areaH = a.areaH;
  form.value.areaTop = a.areaTop;
  form.value.areaLeft = a.areaLeft;
}
// 数字输入微调后同步（AreaPicker 内部 watch 会跟随重摆）
function syncArea() {}

async function submit() {
  const f = form.value;
  if (!f.name || !f.front || !f.back) {
    ElMessage.warning('请填写名称并上传正面和反面底图（必须）');
    return;
  }
  submitting.value = true;
  try {
    const payload = { name: f.name, front: f.front, back: f.back, areaW: f.areaW, areaH: f.areaH, areaTop: f.areaTop, areaLeft: f.areaLeft };
    if (editId.value) await api.put(`/goods/${editId.value}`, payload);
    else await api.post('/goods', payload);
    ElMessage.success(editId.value ? '已更新' : '已添加');
    dialog.value = false;
    load();
  } finally {
    submitting.value = false;
  }
}

async function del(row: GoodsRow) {
  await ElMessageBox.confirm(`删除品类「${row.name}」？`, '提示', { type: 'warning' });
  await api.delete(`/goods/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <span>定制品类（{{ list.length }}）</span>
        <el-button type="primary" @click="openAdd">新增品类</el-button>
      </div>
    </template>

    <el-empty v-if="!list.length" description="暂无品类；H5「开始定制」时用户从这里选择" />
    <el-table v-else :data="list" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="品类名称" width="140" />
      <el-table-column label="正面底图" width="110">
        <template #default="{ row }">
          <el-image :src="row.front" fit="contain" class="w-20 h-20" :preview-src-list="[row.front]" preview-teleported />
        </template>
      </el-table-column>
      <el-table-column label="反面底图" width="110">
        <template #default="{ row }">
          <el-image :src="row.back" fit="contain" class="w-20 h-20" :preview-src-list="[row.back]" preview-teleported />
        </template>
      </el-table-column>
      <el-table-column label="印花区（宽/高/顶/左 %）" width="220">
        <template #default="{ row }">{{ row.areaW }} / {{ row.areaH }} / 顶{{ row.areaTop }} / 左{{ row.areaLeft ?? '居中' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="del(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" :title="editId ? '编辑品类' : '新增品类'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="品类名称">
          <el-input v-model="form.name" placeholder="如：短袖 / 长袖 / 裙子" />
        </el-form-item>
        <el-form-item label="正面底图">
          <el-upload accept="image/*" :show-file-list="false" :http-request="({ file }) => onFront(file)">
            <el-button :loading="frontUploading">上传正面图</el-button>
          </el-upload>
          <el-image v-if="form.front" :src="form.front" fit="contain" class="w-14 h-14 ml-2" />
        </el-form-item>
        <el-form-item label="反面底图">
          <el-upload accept="image/*" :show-file-list="false" :http-request="({ file }) => onBack(file)">
            <el-button :loading="backUploading">上传反面图</el-button>
          </el-upload>
          <el-image v-if="form.back" :src="form.back" fit="contain" class="w-14 h-14 ml-2" />
        </el-form-item>
        <el-form-item label="印花区">
          <AreaPicker v-if="form.front" :src="form.front" :area="form" @change="applyArea" />
          <div v-else class="text-xs text-gray-400">上传正面底图后可在此可视化调整印花区</div>
          <div v-if="form.front" class="flex items-center gap-2 w-full text-xs mt-2 flex-wrap">
            宽 <el-input-number v-model="form.areaW" :min="10" :max="100" size="small" @change="syncArea" />
            高 <el-input-number v-model="form.areaH" :min="10" :max="100" size="small" @change="syncArea" />
            顶边距 <el-input-number v-model="form.areaTop" :min="0" :max="80" size="small" @change="syncArea" />
            左边距 <el-input-number v-model="form.areaLeft" :min="0" :max="90" size="small" @change="syncArea" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
