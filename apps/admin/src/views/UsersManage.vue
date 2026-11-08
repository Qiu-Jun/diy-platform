<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UserRow } from '@diy/shared';
import { api } from '../api/http';
import type { UserRow as ServerUserRow } from '@diy/shared';

const list = ref<(UserRow & { roleName?: string })[]>([]);
const roles = ref<{ id: number; code: string; name: string; perms: string[] }[]>([]);
const dialog = ref(false);
const submitting = ref(false);
const form = ref({ username: '', password: '', nickname: '', roleId: null as number | null });
const self = JSON.parse(localStorage.getItem('diy_user') ?? '{}');

async function load() {
  list.value = (await api.get<{ data: ServerUserRow[] & any[] }>('/users')).data;
  roles.value = (await api.get<{ roles: any[] }>('/roles')).roles;
}

function roleLabel(roleId: number) {
  return roles.value.find((r) => r.id === roleId)?.name ?? roleId;
}

async function submit() {
  if (!form.value.username || !form.value.password || !form.value.roleId) {
    ElMessage.warning('请完整填写账号、密码和角色');
    return;
  }
  submitting.value = true;
  try {
    await api.post('/users', form.value);
    ElMessage.success('已添加');
    dialog.value = false;
    form.value = { username: '', password: '', nickname: '', roleId: null };
    load();
  } finally {
    submitting.value = false;
  }
}

async function resetPwd(row: UserRow & { username: string }) {
  const { value } = await ElMessageBox.prompt('新密码', `重置「${row.username}」的密码`, {
    inputPattern: /\S{6,}/,
    inputErrorMessage: '密码至少 6 位',
  });
  await api.put(`/users/${row.id}`, { password: value });
  ElMessage.success('密码已重置');
}

async function del(row: UserRow & { username: string }) {
  await ElMessageBox.confirm(`删除用户「${row.username}」？`, '提示', { type: 'warning' });
  try {
    await api.delete(`/users/${row.id}`);
    ElMessage.success('已删除');
    load();
  } catch { /* 错误已由拦截器提示 */ }
}

onMounted(load);
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <span>用户列表（{{ list.length }}）</span>
        <el-button type="primary" @click="dialog = true">新增用户</el-button>
      </div>
    </template>

    <el-table :data="list" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="账号" width="160" />
      <el-table-column prop="nickname" label="昵称" width="160" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">{{ roleLabel(row.roleId) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19).replace('T', ' ') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="resetPwd(row)">重置密码</el-button>
          <el-button link type="danger" :disabled="row.id === self.id" @click="del(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" title="新增用户" width="440px">
      <el-form label-width="80px">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="至少 6 位" show-password />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="显示名（可空）" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleId" class="w-full">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
