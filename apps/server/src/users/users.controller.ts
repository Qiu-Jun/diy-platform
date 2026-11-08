import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Perm } from '../auth/guards';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
  @IsOptional() @IsString() nickname?: string;
  @Type(() => Number) @IsInt() roleId: number;
}

class UpdateUserDto {
  @IsOptional() @IsString() nickname?: string;
  @Type(() => Number) @IsOptional() @IsInt() roleId?: number;
  @IsOptional() @IsString() password?: string;
}

@Controller('users')
@Perm('users:manage')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get()
  list() {
    return { data: this.svc.list() };
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    this.svc.remove(id, req.user.id);
    return { ok: true };
  }
}
