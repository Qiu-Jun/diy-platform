<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ApiList, AssetItem, CatItem } from '@diy/shared';
import { api, uploadFile } from '../api/http';

const cats = ref<CatItem[]>([]);
const assets = ref<AssetItem[]>([]);
const currentCat = ref<number | null>(null);
const total = ref(0);
const page = ref(1);
const pageSize = 30;
const newCatLabel = ref('');

async function loadCats() {
  cats.value = (await api.get<{ data: CatItem[] }>('/cats')).data;
  if (cats.value.length && currentCat.value === null) currentCat.value = cats.value[0].id;
}

async function loadAssets() {
  if (currentCat.value === null) { assets.value = []; total.value = 0; return; }
  const res = await api.get<ApiList<AssetItem>>('/assets', { page: page.value, pageSize, cat: currentCat.value });
  assets.value = res.data;
  total.value = res.total;
}

function pickCat(id: number) {
  currentCat.value = id;
  page.value = 1;
  loadAssets();
}

async function addCat() {
  const label = newCatLabel.value.trim();
  if (!label) return;
  await api.post('/cats', { label });
  newCatLabel.value = '';
  await loadCats();
  pickCat(cats.value.find((c) => c.label === label)?.id ?? cats.value[0].id);
  ElMessage.success('分类已添加');
}

async function delCat(cat: CatItem) {
  await ElMessageBox.confirm(`删除分类「${cat.label}」？其下素材不会删除。`, '提示', { type: 'warning' });
  await api.delete(`/cats/${cat.id}`);
  currentCat.value = null;
  await loadCats();
  loadAssets();
}

const uploadingCount = ref(0);

// 走 axios 上传（自动带 token），入库后刷新网格
async function customUpload({ file }: { file: File }) {
  if (currentCat.value === null) return ElMessage.warning('请先选择分类');
  uploadingCount.value++;
  try {
    const up = await uploadFile(file);
    await api.post('/assets', { name: up.name, url: up.url, cat: currentCat.value });
    page.value = 1;
    await loadAssets();
    ElMessage.success('素材已上传');
  } finally {
    uploadingCount.value--;
  }
}

async function del(row: AssetItem) {
  await ElMessageBox.confirm('删除该素材？', '提示', { type: 'warning' });
  await api.delete(`/assets/${row.id}`);
  loadAssets();
}

onMounted(async () => {
  await loadCats();
  loadAssets();
});
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template #header>
      <div class="flex items-center gap-3 flex-wrap">
        <el-tag v-for="c in cats" :key="c.id" :type="c.id === currentCat ? 'primary' : 'info'"
                class="cursor-pointer" size="large" closable @click="pickCat(c.id)" @close="delCat(c)">
          {{ c.label }}
        </el-tag>
        <el-input v-model="newCatLabel" placeholder="新分类名" size="small" class="!w-32" @keyup.enter="addCat" />
        <el-button size="small" @click="addCat">添加分类</el-button>
        <div class="flex-1" />
        <el-upload v-if="currentCat !== null" accept="image/*" multiple
                   :show-file-list="false" :http-request="customUpload">
          <el-button type="primary" :loading="uploadingCount > 0">
            {{ uploadingCount > 0 ? `上传中(${uploadingCount})` : '上传素材' }}
          </el-button>
        </el-upload>
      </div>
    </template>

    <el-empty v-if="!assets.length" description="该分类暂无素材，点击右上角上传" />
    <template v-else>
      <div class="grid grid-cols-6 gap-3">
        <div v-for="a in assets" :key="a.id" class="relative group border rounded overflow-hidden bg-gray-50">
          <el-image :src="a.url" fit="contain" class="w-full aspect-square" :preview-src-list="[a.url]" preview-teleported />
          <div class="absolute inset-x-0 bottom-0 bg-black/45 text-white text-xs px-1 truncate opacity-0 group-hover:opacity-100 transition">
            {{ a.name }}<span v-if="a.createdByName"> · {{ a.createdByName }}</span>
          </div>
          <el-button link type="danger" size="small" class="!absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
                     @click="del(a)">删除</el-button>
        </div>
      </div>
      <el-pagination class="mt-4 justify-end" layout="prev, pager, next, total" :total="total"
                     :page-size="pageSize" :current-page="page"
                     @current-change="(p: number) => { page = p; loadAssets(); }" />
    </template>
  </el-card>
</template>
