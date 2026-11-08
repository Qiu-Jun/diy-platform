import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Perm } from '../auth/guards';
import { FontsService } from './fonts.service';

class CreateFontDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() url: string;
  @IsOptional() @IsString() cat?: string;
}

@Controller('fonts')
export class FontsController {
  constructor(private svc: FontsService) {}

  @Get()
  list() {
    return { data: this.svc.list() };
  }

  @Perm('fonts:manage')
  @Post()
  create(@Body() dto: CreateFontDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.id ?? null);
  }

  @Perm('fonts:manage')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.svc.remove(id);
    return { ok: true };
  }
}
