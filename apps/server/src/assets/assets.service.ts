import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

// 分页结构与 H5 端 /api/v2/assets 的约定一致（见 @diy/shared ApiList）
@Injectable()
export class AssetsService {
  constructor(private db: DbService) {}

  list(opts: { page: number; pageSize: number; cat?: number }) {
    return this.db.listAssets(opts);
  }

  create(dto: { name: string; url: string; cat: number }, by: number | null) {
    return this.db.createAsset(dto, by);
  }

  remove(id: number): void {
    if (!this.db.deleteAsset(id)) throw new NotFoundException('素材不存在');
  }
}
