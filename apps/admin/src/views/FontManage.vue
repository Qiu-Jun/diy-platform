<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FontItem } from '@diy/shared';
import { api, uploadFile } from '../api/http';

const list = ref<FontItem[]>([]);
const dialog = ref(false);
const submitting = ref(false);
const form = ref({ name: '' });
const fileUrl = ref('');
const fontUploading = ref(false);

async function onFontFile(file: File) {
  fontUploading.value = true;
  try {
    const up = await uploadFile(file);
    fileUrl.value = up.url;
    ElMessage.success('字体文件已上传');
  } finally {
    fontUploading.value = false;
  }
}

// 用 FontFace 注册后可直接预览字体效果
async function ensureFontFaces(rows: FontItem[]) {
  for (const f of rows) {
    const family = `f_${f.id}`;
    if (document.fonts.check(`12px "${family}"`)) continue;
    try {
      const face = new FontFace(family, `url(${f.url})`);
      await face.load();
      document.fonts.add(face);
    } catch { /* 字体文件异常时回退默认字体 */ }
  }
}

async function load() {
  const res = await api.get<{ data: FontItem[] }>('/fonts');
  list.value = res.data;
  ensureFontFaces(res.data);
}

function onUploaded(res: { url: string }) {
  fileUrl.value = res.url;
  ElMessage.success('字体文件已上传');
}

async function submit() {
  if (!form.value.name || !fileUrl.value) {
    ElMessage.warning('请填写名称并上传字体文件');
    return;
  }
  submitting.value = true;
  try {
    await api.post('/fonts', { name: form.value.name, url: fileUrl.value });
    ElMessage.success('已添加');
    dialog.value = false;
    form.value = { name: '' };
    fileUrl.value = '';
    load();
  } finally {
    submitting.value = false;
  }
}

async function del(row: FontItem) {
  await ElMessageBox.confirm(`删除字体「${row.name}」？`, '提示', { type: 'warning' });
  await api.delete(`/fonts/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <span>字体列表（{{ list.length }}）</span>
        <el-button type="primary" @click="dialog = true">新增字体</el-button>
      </div>
    </template>

    <el-table :data="list" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="名称" width="140" />
      <el-table-column label="预览">
        <template #default="{ row }">
          <span class="text-xl" :style="{ fontFamily: `'f_${row.id}'` }">DIY 定制预览 AaBb 123 你好</span>
        </template>
      </el-table-column>
      <el-table-column label="文件" width="170">
        <template #default="{ row }">
          <el-link type="primary" :href="row.url" target="_blank">{{ row.url }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="150">
        <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19).replace('T', ' ') || '—' }}</template>
      </el-table-column>
      <el-table-column label="创建人" width="90">
        <template #default="{ row }">{{ row.createdByName || '—' }}</template>
      </el-table-column>
      <el-table-column label="更新人" width="90">
        <template #default="{ row }">{{ row.updatedByName || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="danger" @click="del(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" title="新增字体" width="440px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：站酷快乐体" />
        </el-form-item>
        <el-form-item label="字体文件">
          <el-upload accept=".ttf,.otf,.woff,.woff2" :show-file-list="false" :http-request="({ file }) => onFontFile(file)">
            <el-button :loading="fontUploading">{{ fontUploading ? '上传中…' : '选择文件上传' }}</el-button>
          </el-upload>
          <div v-if="fileUrl" class="text-xs text-green-600 mt-1 w-full">已上传：{{ fileUrl }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
