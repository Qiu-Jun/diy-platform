<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';

const router = useRouter();
const list = ref([]);
const page = ref(1);
const total = ref(0);
const pageSize = 6;
const loading = ref(false);
const tab = ref('all'); // all=全部模板 mine=我的作品
const user = ref(JSON.parse(localStorage.getItem('h5_user') ?? 'null'));
const showAuth = ref(false);
const authMode = ref('login'); // login | register
const authForm = ref({ username: '', password: '', nickname: '' });
const showGoods = ref(false); // 品类选择弹窗
const goodsList = ref([]);

function authHeaders() {
  const token = localStorage.getItem('h5_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function load() {
  loading.value = true;
  try {
    const mine = tab.value === 'mine' ? '&mine=1' : '';
    const j = await fetch(`/api/templates?page=${page.value}&pageSize=${pageSize}${mine}`, { headers: authHeaders() })
      .then((r) => r.json());
    list.value = j.data ?? [];
    total.value = j.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function switchTab(t) {
  if (t === 'mine' && !user.value) { showAuth.value = true; authMode.value = 'login'; return; }
  tab.value = t;
  page.value = 1;
  load();
}

async function submitAuth() {
  const f = authForm.value;
  if (!f.username || !f.password || (authMode.value === 'register' && !f.nickname)) {
    return showToast('请完整填写');
  }
  const path = authMode.value === 'login' ? '/api/auth/login' : '/api/auth/register';
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await res.json();
    if (!res.ok || !j.token) throw new Error(j.message ?? '失败');
    localStorage.setItem('h5_token', j.token);
    localStorage.setItem('h5_user', JSON.stringify(j.user));
    user.value = j.user;
    showAuth.value = false;
    showToast(authMode.value === 'login' ? '登录成功' : '注册成功');
    if (tab.value === 'mine') { page.value = 1; load(); }
  } catch (e) {
    showToast(e.message ?? '操作失败');
  }
}

function logout() {
  localStorage.removeItem('h5_token');
  localStorage.removeItem('h5_user');
  user.value = null;
  if (tab.value === 'mine') { tab.value = 'all'; }
  page.value = 1;
  load();
  showToast('已退出登录');
}

async function delMine(t) {
  const res = await fetch('/api/templates/' + t.id, { method: 'DELETE', headers: authHeaders() });
  if (res.ok) { showToast('已删除'); load(); }
  else showToast((await res.json()).message ?? '删除失败');
}

// 开始定制 → 先选品类
async function openPicker() {
  showGoods.value = true;
  if (!goodsList.value.length) {
    goodsList.value = await fetch('/api/goods').then((r) => r.json()).then((j) => j.data ?? []);
  }
}

function pick(g) {
  showGoods.value = false;
  router.push('/editor?goods=' + g.id);
}

onMounted(load);
</script>

<template>
  <div class="home">
    <header class="topbar">
      <span class="title">DIY 模板</span>
      <span class="topbar-right">
        <van-button size="small" round type="primary" @click="openPicker">开始定制</van-button>
        <template v-if="user">
          <span class="uname">{{ user.nickname || user.username }}</span>
          <van-button size="small" round @click="logout">退出</van-button>
        </template>
        <van-button v-else size="small" round @click="showAuth = true; authMode = 'login'">登录</van-button>
      </span>
    </header>

    <div class="tabs">
      <span class="chip" :class="{ on: tab === 'all' }" @click="switchTab('all')">全部模板</span>
      <span class="chip" :class="{ on: tab === 'mine' }" @click="switchTab('mine')">我的作品</span>
    </div>

    <van-empty v-if="!total && !loading" :description="tab === 'mine' ? '我还没有作品，去定制一个吧' : '还没有模板，点右上角「开始定制」保存一个吧'" />
    <div class="grid">
      <div v-for="t in list" :key="t.id" class="card" @click="router.push('/editor?tpl=' + t.id)">
        <img :src="t.preview" loading="lazy" />
        <div class="info">
          <div class="name">{{ t.name }}</div>
          <div class="date">{{ (t.createdAt || '').slice(0, 16).replace('T', ' ') }}</div>
        </div>
        <van-icon v-if="tab === 'mine' && user" name="delete-o" class="del"
                  @click.stop="delMine(t)" />
      </div>
    </div>

    <van-pagination v-if="total > pageSize" v-model="page" :total-items="total" :items-per-page="pageSize"
                    :force-ellipses="true" class="pager" @change="load" />

    <!-- 品类选择弹窗（开始定制第一步） -->
    <van-popup :show="showGoods" round :style="{ width: '80%' }" @update:show="(v) => showGoods = v">
      <div class="goods-title">选择定制品类</div>
      <van-empty v-if="!goodsList.length" description="暂无可用品类" />
      <div class="goods-grid">
        <div v-for="g in goodsList" :key="g.id" class="goods-card" @click="pick(g)">
          <img :src="g.front" />
          <div class="gname">{{ g.name }}</div>
        </div>
      </div>
    </van-popup>

    <!-- 登录 / 注册弹窗 -->
    <van-popup :show="showAuth" round :style="{ width: '80%' }" @update:show="(v) => showAuth = v">
      <div class="auth-pad">
        <div class="auth-title">{{ authMode === 'login' ? '登录' : '注册' }}</div>
        <van-field v-model="authForm.username" placeholder="账号" clearable />
        <van-field v-model="authForm.password" type="password" placeholder="密码" />
        <van-field v-if="authMode === 'register'" v-model="authForm.nickname" placeholder="昵称" />
        <van-button type="primary" block round
                    @click="submitAuth">{{ authMode === 'login' ? '登录' : '注册并登录' }}</van-button>
        <div class="auth-switch">
          <span v-if="authMode === 'login'" @click="authMode = 'register'">没有账号？去注册</span>
          <span v-else @click="authMode = 'login'">已有账号？去登录</span>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.home { max-width: 430px; margin: 0 auto; min-height: 100vh; background: #f7f7f7; transform: translateZ(0); }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #fff; }
/* H5 未装 UnoCSS —— 顶栏右侧用真实样式对齐 */
.topbar-right { display: flex; align-items: center; gap: 12px; }
.uname { font-size: 12px; color: #999; max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.title { font-size: 17px; font-weight: 700; }
.tabs { display: flex; gap: 8px; padding: 12px 16px 0; }
.chip { padding: 4px 14px; border-radius: 14px; background: #fff; font-size: 12px; color: #666; cursor: pointer; border: 1px solid #e5e5e5; }
.chip.on { background: #111; color: #fff; border-color: #111; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px; }
.card { position: relative; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); cursor: pointer; }
.card img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; background: #f2f2f2; }
.info { padding: 8px 10px 10px; }
.name { font-size: 13px; font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.date { font-size: 11px; color: #999; margin-top: 2px; }
.del { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,.45); color: #fff; border-radius: 50%; padding: 5px; font-size: 14px; }
.pager { margin: 8px 0 24px; }
.goods-title { text-align: center; font-size: 16px; font-weight: 700; padding: 20px 0 6px; }
.goods-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 16px 20px; max-height: 420px; overflow-y: auto; }
.goods-card { background: #f7f7f7; border-radius: 12px; overflow: hidden; cursor: pointer; text-align: center; border: 2px solid transparent; }
.goods-card:active { border-color: #1989fa; }
.goods-card img { width: 100%; aspect-ratio: 1; object-fit: contain; display: block; background: #fff; }
.gname { padding: 8px 0; font-size: 13px; font-weight: 600; color: #333; }
.auth-pad { padding: 20px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
.auth-title { text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.auth-switch { text-align: center; font-size: 12px; color: #1989fa; cursor: pointer; }
</style>
