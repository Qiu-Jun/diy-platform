import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class RolesService {
  constructor(private db: DbService) {}

  list() {
    return { roles: this.db.listRoles(), permissions: this.db.listPermissions() };
  }

  create(dto: { code: string; name: string; perms: string[] }) {
    return this.db.createRole(dto);
  }

  setPerms(id: number, perms: string[]) {
    this.db.setRolePerms(id, perms);
    return { ok: true };
  }

  remove(id: number) {
    this.db.deleteRole(id);
    return { ok: true };
  }
}
