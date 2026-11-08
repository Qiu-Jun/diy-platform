import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { DbService } from '../db/db.service';
import { JWT_SECRET } from './guards';

@Injectable()
export class AuthService {
  constructor(private db: DbService) {}

  login(username: string, password: string) {
    const row = this.db.getAuthByUsername(username);
    if (!row) throw new UnauthorizedException('账号或密码错误');
    const hash = scryptSync(password, 'diy-salt', 64);
    const stored = Buffer.from(row.password_hash, 'hex');
    if (!(stored.length === hash.length && timingSafeEqual(stored, hash))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const token = jwt.sign({ sub: row.id, username: row.username }, JWT_SECRET, { expiresIn: '12h' });
    return { token, user: this.db.getUserWithPerms(row.id) };
  }

  // C 端自助注册：user 角色、source=web，注册即登录
  register(dto: { username: string; password: string; nickname: string }) {
    if (this.db.getAuthByUsername(dto.username)) throw new UnauthorizedException('用户名已被占用');
    const userRole = this.db.listRoles().find((r) => r.code === 'user');
    if (!userRole) throw new UnauthorizedException('用户角色未初始化');
    const user = this.db.createUser({
      username: dto.username,
      password: dto.password,
      nickname: dto.nickname,
      roleId: userRole.id,
      source: 'web',
    });
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    return { token, user: this.db.getUserWithPerms(user.id) };
  }

  me(userId: number) {
    return this.db.getUserWithPerms(userId);
  }
}
