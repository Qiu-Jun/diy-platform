// 运行期路径：以包目录（process.cwd()，pnpm --filter 下即 apps/server）为基准，
// 避免 dist 嵌套层级导致的相对路径错位
import { join } from 'path';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');
export const DATA_DIR = join(process.cwd(), 'data');
