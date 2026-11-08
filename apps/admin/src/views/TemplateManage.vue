<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ApiList, TemplateItem } from '@diy/shared';
import { api, uploadFile } from '../api/http';

const list = ref<TemplateItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 12;

async function load() {
  const res = await api.get<ApiList<TemplateItem>>('/templates', { page: page.value, pageSize });
  list.value = res.data;
  total.value = res.total;
}

async function rename(row: TemplateItem) {
  const { value } = await ElMessageBox.prompt('新名称', '重命名模板', {
    inputValue: row.name,
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空',
  });
  await api.put(`/templates/${row.id}`, { name: value.trim() });
  ElMessage.success('已重命名');
  load();
}

async function del(row: TemplateItem) {
  await ElMessageBox.confirm(`删除模板「${row.name}」？工程数据将一并删除。`, '提示', { type: 'warning' });
  await api.delete(`/templates/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <span>模板列表（{{ total }}）</span>
      </div>
    </template>

    <el-empty v-if="!list.length" description="暂无模板；用户在 H5 编辑页点「保存」后会出现在这里" />
    <el-table v-else :data="list" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="预览" width="110">
        <template #default="{ row }">
          <el-image :src="row.preview" fit="contain" class="w-20 h-20" :preview-src-list="[row.preview]" preview-teleported />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column label="创建时间" width="150">
        <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19).replace('T', ' ') || '—' }}</template>
      </el-table-column>
      <el-table-column label="创建人" width="90">
        <template #default="{ row }">{{ row.createdByName || '—' }}</template>
      </el-table-column>
      <el-table-column label="更新时间" width="150">
        <template #default="{ row }">{{ (row.updatedAt || '').slice(0, 19).replace('T', ' ') || '—' }}</template>
      </el-table-column>
      <el-table-column label="更新人" width="90">
        <template #default="{ row }">{{ row.updatedByName || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="rename(row)">重命名</el-button>
          <el-button link type="danger" @click="del(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > pageSize" class="mt-4 justify-end" layout="prev, pager, next, total"
                   :total="total" :page-size="pageSize" :current-page="page"
                   @current-change="(p: number) => { page = p; load(); }" />
  </el-card>
</template>
