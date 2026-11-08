import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class CatsService {
  constructor(private db: DbService) {}

  list() {
    return this.db.listCats();
  }

  create(dto: { label: string; sort?: number }) {
    return this.db.createCat(dto);
  }

  remove(id: number): void {
    if (!this.db.deleteCat(id)) throw new NotFoundException('分类不存在');
  }
}
