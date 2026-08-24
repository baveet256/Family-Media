import { Logger } from '@nestjs/common';

/**
 * Values that shipped as examples/defaults in the repo. If any of these reach a
 * production boot, the deployment is using a publicly known secret.
 */
const KNOWN_WEAK_SECRETS = new Set([
  'dev-family-media-jwt-secret-change-me',
  'changeme',
  'secret',
]);

const MIN_SECRET_LENGTH = 32;

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

/** Dev-only fallback so local `npm run start:dev` works without a .env. */
export const DEV_JWT_SECRET = 'dev-family-media-jwt-secret-change-me';

export function resolveJwtSecret(secret: string | undefined): string {
  if (secret && secret.length > 0) return secret;
  if (isProduction()) {
    throw new Error('JWT_SECRET is required in production');
  }
  return DEV_JWT_SECRET;
}

/**
 * Runs at module init via ConfigModule's `validate` hook, so a misconfigured
 * production deploy fails to boot instead of silently running insecurely.
 */
export function validateEnv(raw: Record<string, unknown>) {
  const logger = new Logger('EnvValidation');
  const get = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  };

  const errors: string[] = [];
  const warnings: string[] = [];
  const production = raw.NODE_ENV === 'production';

  const jwtSecret = get('JWT_SECRET');
  if (!jwtSecret) {
    (production ? errors : warnings).push(
      'JWT_SECRET is not set. Generate one with: openssl rand -base64 48',
    );
  } else {
    if (KNOWN_WEAK_SECRETS.has(jwtSecret)) {
      (production ? errors : warnings).push(
        'JWT_SECRET is a publicly known example value and must be replaced.',
      );
    }
    if (production && jwtSecret.length < MIN_SECRET_LENGTH) {
      errors.push(
        `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`,
      );
    }
  }

  if (!get('DATABASE_URL')) {
    (production ? errors : warnings).push('DATABASE_URL is not set.');
  }

  if (!get('REDIS_URL')) {
    (production ? errors : warnings).push('REDIS_URL is not set.');
  }

  // OTP dev mode returns the code in the API response — never allowed in prod.
  if (production && (get('OTP_DEV_MODE') ?? '').toLowerCase() === 'true') {
    errors.push(
      'OTP_DEV_MODE=true returns OTP codes in API responses and cannot be enabled in production.',
    );
  }

  if (production && !get('CORS_ALLOWED_ORIGINS')) {
    warnings.push(
      'CORS_ALLOWED_ORIGINS is not set; browser cross-origin requests will be rejected.',
    );
  }

  const publicApiUrl = get('PUBLIC_API_URL');
  if (production && publicApiUrl && publicApiUrl.startsWith('http://')) {
    errors.push('PUBLIC_API_URL must use https:// in production.');
  }

  for (const warning of warnings) logger.warn(warning);

  if (errors.length) {
    throw new Error(
      `Insecure or incomplete environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return raw;
}
