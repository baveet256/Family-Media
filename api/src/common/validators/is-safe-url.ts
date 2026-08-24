import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

const MAX_URL_LENGTH = 2048;

/**
 * URLs supplied by clients are stored and later handed to <Image>, Linking and
 * the web build. Restricting them to http(s) keeps `javascript:` and `data:`
 * payloads out of persisted content.
 */
export function IsSafeUrl() {
  return applyDecorators(
    IsString(),
    MaxLength(MAX_URL_LENGTH),
    Matches(/^https?:\/\/\S+$/i, {
      message: 'must be an http(s) URL',
    }),
  );
}

/** Shared phone shape: 8–15 digits with an optional leading +. */
export function IsPhoneNumber() {
  return applyDecorators(
    IsString(),
    Matches(/^\+?[0-9]{8,15}$/, {
      message: 'phone must be 8–15 digits, optional leading +',
    }),
  );
}
