import { AuthError } from '@hook/domain';
import type { LlmProvider, LlmRequest, TokenVerifier, VerifiedUser } from '../../ports';

const EN = [
  ['contrarian', 'Stop chasing likes. Start chasing replies.'],
  ['mistake_story', 'I made one mistake that cost me my first client.'],
  ['curiosity_gap', 'The reason your posts flop is not your content.'],
  ['direct_question', 'Why do your best ideas get the fewest reads?'],
  ['nobody_tells_you', 'Nobody tells you how lonely building in public feels.'],
  ['number_list', '[X] habits that quietly kill your reach.'],
  ['before_after', 'Before: posts nobody read. After: DMs from founders.'],
  ['warning', 'Read this before you write your next first line.'],
  ['i_was_wrong', 'I was wrong about posting every single day.'],
  ['quick_win', 'One edit that makes any opening line stronger.'],
] as const;

const HI = [
  ['contrarian', 'लाइक्स के पीछे भागना बंद करो, जवाबों के पीछे भागो।'],
  ['mistake_story', 'मेरी एक गलती ने मेरा पहला क्लाइंट छीन लिया।'],
  ['curiosity_gap', 'आपकी पोस्ट फ्लॉप होने की वजह आपका कंटेंट नहीं है।'],
  ['direct_question', 'आपके सबसे अच्छे आइडिया सबसे कम क्यों पढ़े जाते हैं?'],
  ['nobody_tells_you', 'कोई नहीं बताता कि पब्लिक में बनाना कितना अकेला लगता है।'],
  ['number_list', '[X] आदतें जो चुपचाप आपकी पहुंच खत्म कर देती हैं।'],
  ['before_after', 'पहले: कोई नहीं पढ़ता था। अब: फाउंडर्स मैसेज करते हैं।'],
  ['warning', 'अपनी अगली पहली लाइन लिखने से पहले यह पढ़ें।'],
  ['i_was_wrong', 'रोज़ पोस्ट करने के बारे में मैं गलत था।'],
  ['quick_win', 'एक बदलाव जो किसी भी पहली लाइन को मज़बूत बना देता है।'],
] as const;

/**
 * DEVELOPMENT ONLY (DEV_FAKE_AI=1): canned, honest, schema-valid answers so the whole app can
 * run end to end without provider keys. parseEnv() refuses this outside development.
 */
export class FakeLlmProvider implements LlmProvider {
  public readonly id = 'dev-fake';

  public complete(request: LlmRequest): Promise<string> {
    const hindi = request.system.includes('Devanagari');
    const lines = hindi ? HI : EN;
    if (request.system.includes('"spokenLine"')) {
      return Promise.resolve(JSON.stringify({
        spokenLine: lines[0][1],
        onScreenText: lines[2][1].slice(0, 50),
        visualIdea: hindi ? 'कैमरे की ओर देखते हुए फ़ोन नीचे रखें।' : 'Look at the camera and put your phone face down.',
        beats: [
          { atSec: 0, action: hindi ? 'हुक बोलें' : 'Say the hook' },
          { atSec: 3, action: hindi ? 'समस्या दिखाएं' : 'Show the problem' },
          { atSec: 8, action: hindi ? 'समाधान बताएं' : 'Give the fix' },
        ],
      }));
    }
    if (request.system.includes('"post"')) {
      return Promise.resolve(JSON.stringify({ post: `${lines[1][1]}\n\n${hindi ? 'यहाँ आपकी पोस्ट का बेहतर ढांचा है।' : 'Here is your post, restructured to be easier to read.'}`, hookFrameworkId: 'mistake_story' }));
    }
    return Promise.resolve(JSON.stringify({ hooks: lines.map(([frameworkId, text]) => ({ frameworkId, text })) }));
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** DEVELOPMENT ONLY (DEV_AUTH=1): "Bearer dev.<uuid>". Refused outside development by parseEnv(). */
export class DevTokenVerifier implements TokenVerifier {
  public verify(token: string): Promise<VerifiedUser> {
    const id = token.startsWith('dev.') ? token.slice(4).toLowerCase() : '';
    if (!UUID.test(id)) return Promise.reject(new AuthError());
    return Promise.resolve({ id, email: null });
  }
}
