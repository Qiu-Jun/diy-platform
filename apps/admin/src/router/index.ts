import { createRouter, createWebHistory } from 'vue-router';
import AdminLayout from '../layouts/AdminLayout.vue';

// 未登录跳登录页（/login 除外）
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('../views/Login.vue'), meta: { title: '登录' } },
    { path: '/', component: AdminLayout, redirect: '/fonts', children: [
      { path: 'fonts', component: () => import('../views/FontManage.vue'), meta: { title: '字体管理' } },
      { path: 'assets', component: () => import('../views/AssetManage.vue'), meta: { title: '素材管理' } },
      { path: 'goods', component: () => import('../views/GoodsManage.vue'), meta: { title: '定制管理' } },
      { path: 'templates', component: () => import('../views/TemplateManage.vue'), meta: { title: '模板管理' } },
      { path: 'users', component: () => import('../views/UsersManage.vue'), meta: { title: '用户管理' } },
      { path: 'roles', component: () => import('../views/RolesManage.vue'), meta: { title: '角色管理' } },
    ] },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('diy_token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) return '/';
});

export default router;
