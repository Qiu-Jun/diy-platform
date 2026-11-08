import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import * as jwt from 'jsonwebtoken';
import { JWT_SECRET, Perm, Public } from '../auth/guards';
import { TemplatesService } from './templates.service';

class ListTemplateQuery {
  @Type(() => Number) page?: number;
  @Type(() => Number) pageSize?: number;
  @IsOptional() @IsString() mine?: string;
}

class CreateTemplateDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() preview: string; // 预览图 /uploads/xxx.png
  @IsObject() @IsNotEmpty() data: Record<string, any>; // 工程 JSON（serializeProject 输出）
}

class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() preview?: string;
  @IsOptional() @IsObject() data?: Record<string, any>;
}

@Controller('templates')
export class TemplatesController {
  constructor(private svc: TemplatesService) {}

  @Get()
  list(@Query() q: ListTemplateQuery, @Req() req: any) {
    // mine=1 且携带有效 token → 只看自己的作品（匿名时忽略，返回全部）
    let userId: number | undefined;
    if (q.mine) {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      try { userId = (jwt.verify(token, JWT_SECRET) as any).sub; } catch { /* 匿名则忽略 mine */ }
    }
    return this.svc.list({ page: q.page ?? 1, pageSize: q.pageSize ?? 6, userId });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.get(id);
  }

  // H5 编辑页保存（匿名可存，登录后台用户保存时记录操作人）
  @Public()
  @Post()
  create(@Body() dto: CreateTemplateDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.id ?? null);
  }

  // 更新（二次编辑保存）：未认领的模板匿名可编辑；已认领的仅作者本人或 templates:manage 权限
  @Public()
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemplateDto, @Req() req: any) {
    const row = this.svc.get(id);
    const user = req.user;
    const isManager = user && (user.roleCode === 'admin' || (user.perms ?? []).includes('templates:manage'));
    const isOwner = user && row.created_by === user.id;
    if (!isManager && !isOwner && row.created_by) throw new ForbiddenException('只能编辑自己的模板');
    return this.svc.update(id, { ...dto, by: user?.id ?? null });
  }

  // 删除：模板作者本人 或 拥有 templates:manage 权限（后台）
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const row = this.svc.get(id);
    const user = req.user;
    const isOwner = user && row.created_by === user.id;
    const isManager = user && (user.roleCode === 'admin' || (user.perms ?? []).includes('templates:manage'));
    if (!isOwner && !isManager) throw new ForbiddenException('只能删除自己的模板');
    this.svc.remove(id);
    return { ok: true };
  }
}
