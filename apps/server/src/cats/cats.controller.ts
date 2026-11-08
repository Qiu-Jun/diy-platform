import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Perm } from '../auth/guards';
import { CatsService } from './cats.service';

class CreateCatDto {
  @IsString() @IsNotEmpty() label: string;
  @IsOptional() sort?: number;
}

@Controller('cats')
export class CatsController {
  constructor(private svc: CatsService) {}

  @Get()
  list() {
    return { data: this.svc.list() };
  }

  @Perm('assets:manage')
  @Post()
  create(@Body() dto: CreateCatDto) {
    return this.svc.create(dto);
  }

  @Perm('assets:manage')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.svc.remove(id);
    return { ok: true };
  }
}
