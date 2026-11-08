import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

// 定制品类：底图必须有正反面（front/back），印花区比例可选（缺省 短袖实测值）
@Injectable()
export class GoodsService {
  constructor(private db: DbService) {}

  list() {
    return this.db.listGoods();
  }

  create(dto: { name: string; front: string; back: string; areaW?: number; areaH?: number; areaTop?: number }, by: number | null) {
    return { id: this.db.createGoods(dto, by) };
  }

  update(id: number, dto: { name?: string; front?: string; back?: string; areaW?: number; areaH?: number; areaTop?: number }) {
    this.db.updateGoods(id, dto);
    return { ok: true };
  }

  remove(id: number) {
    this.db.deleteGoods(id);
    return { ok: true };
  }
}
