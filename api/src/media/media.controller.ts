import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { AuthGuard } from '../common/guards/auth.guard';
import { PresignMediaDto } from '../posts/dto/posts.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

@Controller('media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly config: ConfigService) {}

  private publicBase(): string {
    const port = this.config.get<string>('PORT') ?? '3000';
    return (
      this.config.get<string>('PUBLIC_API_URL') ?? `http://localhost:${port}`
    );
  }

  /** Dev-friendly presign: returns a local upload endpoint + final public URL. */
  @Post('presign')
  presign(@Body() dto: PresignMediaDto) {
    ensureUploadDir();
    const ext =
      dto.filename && extname(dto.filename)
        ? extname(dto.filename).toLowerCase()
        : dto.mediaType === 'video'
          ? '.mp4'
          : '.jpg';
    const key = `${randomUUID()}${ext}`;
    const base = this.publicBase();
    return {
      key,
      uploadUrl: `${base}/media/upload`,
      publicUrl: `${base}/uploads/${key}`,
      fields: { key },
      method: 'POST',
      // Client should multipart upload with field "file" and "key"
      mediaType: dto.mediaType,
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
          const key =
            typeof req.body?.key === 'string' && req.body.key.length > 0
              ? req.body.key.replace(/[^a-zA-Z0-9._-]/g, '')
              : `${randomUUID()}${extname(file.originalname) || '.bin'}`;
          cb(null, key);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('key') key?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const filename = file.filename || key;
    const base = this.publicBase();
    return {
      ok: true,
      key: filename,
      publicUrl: `${base}/uploads/${filename}`,
      contentType: file.mimetype,
      size: file.size,
    };
  }
}
