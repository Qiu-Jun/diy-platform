import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService, UserRow } from '../db/db.service';

@Injectable()
export class UsersService {
  constructor(private db: DbService) {}

  list(): UserRow[] {
    return this.db.listUsers();
  }

  create(dto: { username: string; password: string; nickname?: string; roleId: number }): UserRow {
    const dup = this.db.getAuthByUsername(dto.username);
    if (dup) throw new NotFoundException('用户名已存在');
    return this.db.createUser(dto);
  }

  update(id: number, dto: { nickname?: string; roleId?: number; password?: string }): UserRow {
    return this.db.updateUser(id, dto);
  }

  remove(id: number, selfId: number): void {
    if (id === selfId) throw new NotFoundException('不能删除自己');
    if (this.db.countUsers() <= 1) throw new NotFoundException('至少保留一个账号');
    this.db.deleteUser(id);
  }
}
