<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { Tickets, Picture, Files, User, Avatar, Goods } from '@element-plus/icons-vue';
import { currentUser, hasPerm } from '../api/http';


const route = useRoute();
const router = useRouter();
const user = currentUser();

function logout() {
  localStorage.removeItem('diy_token');
  localStorage.removeItem('diy_user');
  router.push('/login');
}
</script>

<template>
  <el-container class="h-full">
    <el-aside width="200px" class="aside">
      <div class="logo">管理后台</div>
      <el-menu router :default-active="route.path" background-color="transparent">
        <el-menu-item index="/fonts"><el-icon><Tickets /></el-icon>字体管理</el-menu-item>
        <el-menu-item index="/assets"><el-icon><Picture /></el-icon>素材管理</el-menu-item>
        <el-menu-item v-if="hasPerm('goods:manage')" index="/goods"><el-icon><Goods /></el-icon>定制管理</el-menu-item>
        <el-menu-item index="/templates"><el-icon><Files /></el-icon>模板管理</el-menu-item>
        <el-menu-item v-if="hasPerm('users:manage')" index="/users"><el-icon><User /></el-icon>用户管理</el-menu-item>
        <el-menu-item v-if="hasPerm('users:manage')" index="/roles"><el-icon><Avatar /></el-icon>角色管理</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header flex items-center justify-between" height="56px">
        <span>{{ route.meta.title }}</span>
        <span class="flex items-center gap-3 text-sm">
          <span class="text-gray-500">{{ user?.nickname || user?.username }}</span>
          <el-link type="danger" underline="never" @click="logout">退出登录</el-link>
        </span>
      </el-header>
      <el-main class="!p-0">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style lang="scss" scoped>
.header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 600;
}
</style>
