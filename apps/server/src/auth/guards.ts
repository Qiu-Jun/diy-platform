import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { DbService } from '../db/db.service';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'diy-dev-secret-change-me';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const PERM_KEY = 'perm';
export const Perm = (code: string) => SetMetadata(PERM_KEY, code);
export const AUTH_KEY = 'forceAuth';
export const Auth = () => SetMetadata(AUTH_KEY, true);

// 全局守卫：默认 GET 读接口公开（H5 浏览），写操作 / 标记了 @Perm / @Auth 的需要 JWT；
// @Public 彻底放行（登录接口、H5 保存模板）。
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private db: DbService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, handler);
    const perm = this.reflector.getAllAndOverride<string>(PERM_KEY, handler);
    const force = this.reflector.getAllAndOverride<boolean>(AUTH_KEY, handler);

    // 可选鉴权：带了有效 token 就解析（供归属/审计），无效/缺失走匿名
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        const u = this.db.getUserWithPerms(Number(payload.sub));
        if (u) req.user = u;
      } catch { /* 无效/过期 token 忽略，走匿名 */ }
    }

    if (isPublic) return true;
    if (req.method === 'GET' && !perm && !force) return true;
    if (!req.user) throw new UnauthorizedException('未登录');
    return true;
  }
}

// 权限守卫：校验 @Perm 标注的权限点（admin 角色直通）
@Injectable()
export class PermGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perm = this.reflector.getAllAndOverride<string>(PERM_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!perm) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException('未登录');
    if (user.roleCode === 'admin' || (user.perms ?? []).includes(perm)) return true;
    throw new ForbiddenException('没有操作权限');
  }
}
