export { TextSanitizer } from '@hook/domain';

export type { DimensionKey, ScoringInput, DimensionResult, DimensionScorer } from './scoring/types';
export { CuriosityScorer } from './scoring/curiosity';
export { SpecificityScorer } from './scoring/specificity';
export { EmotionScorer } from './scoring/emotion';
export { ClarityScorer } from './scoring/clarity';
export { PlatformFitScorer } from './scoring/platform-fit';
export { HookScorer, type HookScore } from './scoring/hook-scorer';

export { FeedPreviewModel, type FeedPreview } from './preview/feed-preview';

export { wrapText } from './share/wrap-text';
export { ShareCardRenderer, type ShareCardSize } from './share/share-card';

export { ApiError } from './api/api-error';
export { ApiClient, type ApiClientOptions } from './api/api-client';
export { SwipeFileClient } from './api/swipe-file-client';

export { VoiceProfileStore, type VoiceProfile } from './voice/voice-profile-store';
