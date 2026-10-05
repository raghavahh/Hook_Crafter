import { z } from 'zod';
import { LanguageSchema } from '../language';
import { GeneratePlatformSchema, PlatformSchema } from '../platform';
import { HOOK_SET_SIZE } from '../hook';
import { boundedText, IsoDateTimeSchema, UuidSchema } from './common';

export const TONES = ['bold', 'friendly', 'professional', 'witty', 'inspiring', 'urgent'] as const;
export const ToneSchema = z.enum(TONES);
export type Tone = z.infer<typeof ToneSchema>;

/** Optional text where a blank form field means "not provided". */
function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    boundedText(1, max).optional(),
  );
}

export const FrameworkIdSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/u);
const TurnstileTokenSchema = z.string().min(1).max(2048);

export const VoiceProfileSchema = z.strictObject({
  niche: boundedText(0, 60),
  audience: boundedText(0, 100),
  style: boundedText(0, 100),
  avoid: boundedText(0, 100),
});
export type VoiceProfileInput = z.input<typeof VoiceProfileSchema>;

export const GenerateRequestSchema = z.strictObject({
  topic: boundedText(1, 5000),
  platform: GeneratePlatformSchema,
  language: LanguageSchema,
  tone: ToneSchema,
  audience: optionalText(100),
  voice: VoiceProfileSchema.optional(),
  turnstileToken: TurnstileTokenSchema.optional(),
});
export type GenerateRequest = z.output<typeof GenerateRequestSchema>;

export const HookOutSchema = z.strictObject({
  text: z.string().min(1).max(500),
  frameworkId: FrameworkIdSchema,
  platform: PlatformSchema,
});
export type HookOut = z.infer<typeof HookOutSchema>;

export const GenerateResponseSchema = z.strictObject({
  hooks: z.array(HookOutSchema).length(HOOK_SET_SIZE),
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

export const RewritePostRequestSchema = z.strictObject({
  post: boundedText(1, 5000),
  platform: GeneratePlatformSchema,
  language: LanguageSchema,
});
export type RewritePostRequest = z.output<typeof RewritePostRequestSchema>;

export const RewritePostResponseSchema = z.strictObject({
  post: z.string().min(1).max(6000),
  hookFrameworkId: FrameworkIdSchema,
});
export type RewritePostResponse = z.infer<typeof RewritePostResponseSchema>;

export const REEL_DURATIONS = [15, 30, 60] as const;
export const ReelsRequestSchema = z.strictObject({
  topic: boundedText(1, 3000),
  language: LanguageSchema,
  durationSec: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});
export type ReelsRequest = z.output<typeof ReelsRequestSchema>;

export const ReelBeatSchema = z.strictObject({
  atSec: z.number().int().min(0).max(60),
  action: z.string().min(1).max(200),
});
export const ReelsResponseSchema = z.strictObject({
  spokenLine: z.string().min(1).max(200),
  onScreenText: z.string().min(1).max(120),
  visualIdea: z.string().min(1).max(300),
  beats: z.array(ReelBeatSchema).min(2).max(8),
});
export type ReelsResponse = z.infer<typeof ReelsResponseSchema>;

export const SwipeHookSchema = z.strictObject({
  id: UuidSchema,
  text: z.string(),
  frameworkId: FrameworkIdSchema,
  platform: PlatformSchema,
  language: LanguageSchema,
  collection: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type SwipeHook = z.infer<typeof SwipeHookSchema>;

export const SwipeListQuerySchema = z.strictObject({
  platform: PlatformSchema.optional(),
  frameworkId: FrameworkIdSchema.optional(),
  collection: optionalText(40),
  cursor: z.string().max(200).optional(),
});
export type SwipeListQuery = z.output<typeof SwipeListQuerySchema>;

export const SwipeListResponseSchema = z.strictObject({
  items: z.array(SwipeHookSchema),
  nextCursor: z.string().nullable(),
  count: z.number().int().min(0),
  limit: z.number().int().min(0),
});
export type SwipeListResponse = z.infer<typeof SwipeListResponseSchema>;

export const SwipeSaveRequestSchema = z.strictObject({
  text: boundedText(1, 500),
  frameworkId: FrameworkIdSchema,
  platform: PlatformSchema,
  language: LanguageSchema,
  collection: optionalText(40),
});
export type SwipeSaveRequest = z.output<typeof SwipeSaveRequestSchema>;

export const SwipeSaveResponseSchema = z.strictObject({ id: UuidSchema });

export const HistoryItemSchema = z.strictObject({
  id: UuidSchema,
  feature: z.enum(['generate', 'post_rewrite', 'reels']),
  createdAt: IsoDateTimeSchema,
  title: z.string(),
  output: z.unknown(),
});
export const HistoryResponseSchema = z.strictObject({ items: z.array(HistoryItemSchema) });
export type HistoryItem = z.infer<typeof HistoryItemSchema>;
