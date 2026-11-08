import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Perm } from '../auth/guards';
import { GoodsService } from './goods.service';

class CreateGoodsDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() front: string; // 正面底图 /uploads/xxx.png（必须）
  @IsString() @IsNotEmpty() back: string;  // 反面底图 /uploads/xxx.png（必须）
  @Type(() => Number) @IsNumber() areaW?: number; // 印花区宽 %（相对衣服包围盒）
  @Type(() => Number) @IsNumber() areaH?: number; // 印花区高 %
  @Type(() => Number) @IsNumber() areaTop?: number; // 印花区顶边距 %
  @Type(() => Number) @IsOptional() @IsNumber() areaLeft?: number | null; // 印花区左边距 %（空=水平居中）
}

@Controller('goods')
export class GoodsController {
  constructor(private svc: GoodsService) {}

  @Get()
  list() {
    return { data: this.svc.list() };
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.list().find((g) => g.id === id) ?? null;
  }

  @Perm('goods:manage')
  @Post()
  create(@Body() dto: CreateGoodsDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.id ?? null);
  }

  @Perm('goods:manage')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateGoodsDto) {
    return this.svc.update(id, dto);
  }

  @Perm('goods:manage')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
