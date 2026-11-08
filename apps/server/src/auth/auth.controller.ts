import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Auth, Public } from './guards';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
}

class RegisterDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
  @IsString() @IsNotEmpty() nickname: string;
}

@Controller('auth')
export class AuthController {
  constructor(private svc: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.svc.login(dto.username, dto.password);
  }

  // C 端自助注册：自动归入 user 角色，注册即登录
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.svc.register(dto);
  }

  @Auth()
  @Get('me')
  me(@Req() req: any) {
    return this.svc.me(req.user.id);
  }
}
