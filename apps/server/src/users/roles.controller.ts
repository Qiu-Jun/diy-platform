import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { Perm } from '../auth/guards';
import { RolesService } from './roles.service';

class CreateRoleDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsArray() perms: string[];
}

class SetPermsDto {
  @IsArray() perms: string[];
}

@Controller('roles')
@Perm('users:manage')
export class RolesController {
  constructor(private svc: RolesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get('permissions')
  permissions() {
    return { data: this.svc.list().permissions };
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.svc.create(dto);
  }

  @Put(':id/perms')
  setPerms(@Param('id', ParseIntPipe) id: number, @Body() dto: SetPermsDto) {
    return this.svc.setPerms(id, dto.perms);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
