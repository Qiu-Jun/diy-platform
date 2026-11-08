import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({ baseURL: '/api', timeout: 30000 });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('diy_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message ?? err.message ?? '请求失败';
    if (status === 401) {
      localStorage.removeItem('diy_token');
      localStorage.removeItem('diy_user');
      if (location.pathname !== '/login') location.href = '/login';
    }
    ElMessage.error(msg);
    return Promise.reject(err);
  },
);

// 拦截器已解包 axios response，第二个泛型即业务数据类型
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) => http.get<unknown, T>(url, { params }),
  post: <T>(url: string, data?: unknown) => http.post<unknown, T>(url, data),
  put: <T>(url: string, data?: unknown) => http.put<unknown, T>(url, data),
  delete: <T>(url: string) => http.delete<unknown, T>(url),
};

// 当前登录用户（登录时写入）
export interface CurrentUser {
  id: number;
  username: string;
  nickname: string | null;
  roleCode: string;
  roleName: string;
  perms: string[];
}
export function currentUser(): CurrentUser | null {
  const raw = localStorage.getItem('diy_user');
  return raw ? JSON.parse(raw) : null;
}
export function hasPerm(code: string): boolean {
  const u = currentUser();
  if (!u) return false;
  return u.roleCode === 'admin' || (u.perms ?? []).includes(code);
}

// 统一上传：走 axios（自动带 Authorization），el-upload 用 :http-request 调它
export async function uploadFile(file: File): Promise<{ url: string; name: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  return http.post<unknown, { url: string; name: string; size: number }>('/upload', fd);
}

export default http;
