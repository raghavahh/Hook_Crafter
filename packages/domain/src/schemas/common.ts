import { z } from 'zod';
import { ERROR_CODES } from '../errors';
import { codePointLength, TextSanitizer } from '../text';

/**
 * Text input: sanitised (Unicode safety), trimmed, then length-checked in code
 * points, the same unit as Postgres char_length() and the UI counter.
 */
export function boundedText(min: number, max: number) {
  return z
    .string()
    .max(max * 4)
    .transform((value) => TextSanitizer.clean(value).trim())
    .refine((value) => {
      const length = codePointLength(value);
      return length >= min && length <= max;
    }, `Must be ${String(min)}-${String(max)} characters`);
}

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const UuidSchema = z.uuid();

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
