<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const router = useRouter();
const form = ref({ username: '', password: '' });
const loading = ref(false);

async function submit() {
  if (!form.value.username || !form.value.password) return ElMessage.warning('请输入账号和密码');
  loading.value = true;
  try {
    const res = await axios.post('/api/auth/login', form.value);
    localStorage.setItem('diy_token', res.data.token);
    localStorage.setItem('diy_user', JSON.stringify(res.data.user));
    router.push('/');
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message ?? '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <el-card class="login-card" shadow="always">
      <div class="title">管理后台</div>
      <el-form @keyup.enter="submit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="账号" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" size="large" class="w-full" :loading="loading" @click="submit">登 录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.login-wrap {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1d3557, #457b9d);
}
.login-card { width: 380px; }
.title { text-align: center; font-size: 20px; font-weight: 700; margin-bottom: 24px; letter-spacing: 2px; }
</style>
