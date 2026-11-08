import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService, FontRow } from '../db/db.service';

@Injectable()
export class FontsService {
  constructor(private db: DbService) {}

  list(): FontRow[] {
    return this.db.listFonts(); // 新上传的在前
  }

  create(dto: { name: string; url: string; cat?: string }, by: number | null): FontRow {
    return this.db.createFont(dto, by);
  }

  remove(id: number): void {
    if (!this.db.deleteFont(id)) throw new NotFoundException('字体不存在');
  }
}
