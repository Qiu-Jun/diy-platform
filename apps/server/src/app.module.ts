import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard, PermGuard } from './auth/guards';
import { UploadModule } from './upload/upload.module';
import { FontsModule } from './fonts/fonts.module';
import { CatsModule } from './cats/cats.module';
import { AssetsModule } from './assets/assets.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';
import { GoodsModule } from './goods/goods.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    UsersModule,
    UploadModule,
    FontsModule,
    CatsModule,
    AssetsModule,
    TemplatesModule,
    GoodsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermGuard },
  ],
})
export class AppModule {}
