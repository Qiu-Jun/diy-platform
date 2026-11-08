// 全平台共享类型（仅类型，运行时零依赖）
// 与 H5 端 /api/v2 的分页返回结构保持一致，便于后续 H5 接真实后端

export interface ApiList<T> {
  total: number;
  per_page: number;
  last_page: number;
  data: T[];
}

export interface FontItem {
  id: number;
  name: string;
  url: string; // /uploads/xxx.ttf
  cat?: string;
  createdAt?: string;
  createdByName?: string | null;
  updatedByName?: string | null;
}

export interface CatItem {
  id: number;
  label: string;
  sort: number;
}

export interface AssetItem {
  id: number;
  name: string;
  url: string; // /uploads/xxx.png
  cat: number; // 分类 id
  createdByName?: string | null;
}

// 模板 = 用户保存的定制工程；列表接口不含 data 大字段
export interface TemplateItem {
  id: number;
  name: string;
  preview: string; // /uploads/xxx.png
  createdAt: string;
  createdByName?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
}
