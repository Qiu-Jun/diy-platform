import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Public } from '../auth/guards';
import { UPLOAD_DIR } from '../consts';

// 统一上传入口：POST /api/upload (multipart, 字段名 file)
// H5 匿名可传（C 端登录用户带 token 时归属会记录），文件落在服务端 uploads/ 目录，
// 通过 /uploads/<文件名> 静态访问
@Controller('upload')
export class UploadController {
  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_, file, cb) => {
          const ext = extname(file.originalname) || '';
          cb(null, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${ext}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未收到文件（字段名必须为 file）');
    return { url: `/uploads/${file.filename}`, name: file.originalname, size: file.size };
  }
}
