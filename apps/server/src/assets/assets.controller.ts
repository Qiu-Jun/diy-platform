import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Perm } from '../auth/guards';
import { AssetsService } from './assets.service';

class ListAssetQuery {
  @Type(() => Number) @IsOptional() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @Min(1) @Max(100) pageSize?: number;
  @Type(() => Number) @IsOptional() @IsInt() cat?: number;
}

class CreateAssetDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() url: string;
  @Type(() => Number) @IsInt() cat: number;
}

@Controller('assets')
export class AssetsController {
  constructor(private svc: AssetsService) {}

  @Get()
  list(@Query() q: ListAssetQuery) {
    return this.svc.list({ page: q.page ?? 1, pageSize: q.pageSize ?? 30, cat: q.cat });
  }

  @Perm('assets:manage')
  @Post()
  create(@Body() dto: CreateAssetDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.id ?? null);
  }

  @Perm('assets:manage')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.svc.remove(id);
    return { ok: true };
  }
}
