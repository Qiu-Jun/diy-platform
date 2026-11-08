<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api/http';

const roles = ref<{ id: number; code: string; name: string; perms: string[] }[]>([]);
const permissions = ref<{ code: string; name: string }[]>([]);
const dialog = ref(false);
const form = ref({ code: '', name: '', perms: [] as string[] });

async function load() {
  const res = await api.get<{ roles: any[]; permissions: any[] }>('/roles');
  roles.value = res.roles;
  permissions.value = res.permissions;
}

function permName(code: string) {
  return permissions.value.find((p) => p.code === code)?.name ?? code;
}

async function addRole() {
  const { value } = await ElMessageBox.prompt('角色英文标识（如 operator）', '新增角色', {
    inputPattern: /^[a-z][a-z0-9_]*$/i,
    inputErrorMessage: '仅限字母数字下划线',
  });
  const { value: name } = await ElMessageBox.prompt('角色显示名', '新增角色', { inputPattern: /\S+/, inputErrorMessage: '不能为空' });
  await api.post('/roles', { code: value.trim(), name: name.trim(), perms: [] });
  ElMessage.success('角色已添加');
  load();
}

async function togglePerm(roleId: number, code: string, checked: boolean) {
  const role = roles.value.find((r) => r.id === roleId)!;
  const perms = checked ? [...new Set([...role.perms, code])] : role.perms.filter((p) => p !== code);
  await api.put(`/roles/${roleId}/perms`, { perms });
  role.perms = perms;
  ElMessage.success('权限已更新');
}

async function del(roleId: number, name: string) {
  await ElMessageBox.confirm(`删除角色「${name}」？`, '提示', { type: 'warning' });
  try {
    await api.delete(`/roles/${roleId}`);
    ElMessage.success('已删除');
    load();
  } catch { /* 拦截器已提示（角色下有用户等） */ }
}

onMounted(load);
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <span>角色与权限（RBAC）</span>
        <el-button type="primary" @click="addRole">新增角色</el-button>
      </div>
    </template>

    <div class="mb-4 text-xs text-gray-400">勾选 = 该角色拥有对应写操作权限（读接口对所有人生效）；admin 角色拥有全部权限且不可修改</div>
    <el-table :data="roles" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="角色" width="120" />
      <el-table-column prop="code" label="标识" width="120" />
      <el-table-column label="权限">
        <template #default="{ row }">
          <div class="flex flex-wrap gap-2">
            <el-checkbox v-for="p in permissions" :key="p.code"
                         :model-value="row.perms.includes(p.code)"
                         :disabled="row.code === 'admin'"
                         @change="(v: any) => togglePerm(row.id, p.code, v)">{{ p.name }}</el-checkbox>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="danger" :disabled="row.code === 'admin'" @click="del(row.id, row.name)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
