import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { isProduction } from './config/env.validation';

function corsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  // The mobile app sends no Origin header, so an empty allowlist in production
  // blocks browsers without affecting native clients.
  return isProduction() ? [] : true;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Keep verbose logs out of production stdout.
    logger: isProduction()
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Required for correct client IPs (rate limiting) behind a load balancer.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // API serves JSON and user media, not HTML documents.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    setHeaders: (res) => {
      // Uploads are user-controlled: never let a browser sniff or render them
      // as HTML/JS from this origin.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Family Media API listening on port ${port}`);
}
void bootstrap();
