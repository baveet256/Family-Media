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
import { join } from 'path';
import { AuthGuard } from '../common/guards/auth.guard';
import { PresignMediaDto } from '../posts/dto/posts.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Only formats the app actually renders. Anything else (svg, html, pdf, bin)
 * is rejected, since uploads are served back over HTTP.
 */
const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

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
    const ext = dto.mediaType === 'video' ? '.mp4' : '.jpg';
    const key = `${randomUUID()}${ext}`;
    const base = this.publicBase();
    return {
      key,
      uploadUrl: `${base}/media/upload`,
      publicUrl: `${base}/uploads/${key}`,
      fields: { key },
      method: 'POST',
      // Client should multipart upload with field "file"
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
        // Keys are always server-generated. A client-supplied name could
        // traverse paths or overwrite another user's existing upload.
        filename: (_req, file, cb) => {
          const ext = ALLOWED_MIME_EXT[file.mimetype];
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_EXT[file.mimetype]) {
          return cb(
            new BadRequestException(`Unsupported file type: ${file.mimetype}`),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const base = this.publicBase();
    return {
      ok: true,
      key: file.filename,
      publicUrl: `${base}/uploads/${file.filename}`,
      contentType: file.mimetype,
      size: file.size,
    };
  }
}
