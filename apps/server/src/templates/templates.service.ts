import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { DbService, TemplateRow } from '../db/db.service';
import { UPLOAD_DIR } from '../consts';

// 模板 = 用户保存的定制工程（JSON）。列表接口不带 data 大字段，加载时单独取。
// 二次编辑保存走 update：id 不变，data/preview 整体替换，旧预览图文件随之清理。
@Injectable()
export class TemplatesService {
  constructor(private db: DbService) {}

  private removePreviewFile(url?: string) {
    if (!url || !url.startsWith('/uploads/')) return;
    const file = join(UPLOAD_DIR, basename(url));
    if (existsSync(file)) unlinkSync(file);
  }

  list(opts: { page: number; pageSize: number; userId?: number }) {
    return this.db.listTemplates(opts);
  }

  get(id: number): TemplateRow {
    return this.db.getTemplate(id);
  }

  create(dto: { name: string; preview: string; data: unknown }, by: number | null) {
    return this.db.createTemplate(dto, by);
  }

  update(id: number, dto: { name?: string; preview?: string; data?: unknown; by?: number | null }): TemplateRow {
    if (!this.db.templateExists(id)) throw new NotFoundException('模板不存在');
    const old = this.db.getTemplate(id);
    const row = this.db.updateTemplate(id, dto);
    if (dto.preview !== undefined && old.preview !== row.preview) this.removePreviewFile(old.preview);
    return row;
  }

  remove(id: number): void {
    if (!this.db.templateExists(id)) throw new NotFoundException('模板不存在');
    const old = this.db.getTemplate(id);
    this.db.deleteTemplate(id);
    this.removePreviewFile(old.preview);
  }
}
