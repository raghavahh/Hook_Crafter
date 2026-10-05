import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AuthError } from '@hook/domain';
import type { TokenVerifier, VerifiedUser } from '../../ports';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * T1 / S-01, S-02: signature via JWKS, algorithm pinned (asymmetric only, so `alg: none` and
 * HS256 forgeries fail), exp/iss/aud checked, role must be `authenticated` (not anon).
 */
export class SupabaseJwtVerifier implements TokenVerifier {
  readonly #jwks: JWTVerifyGetKey;
  readonly #issuer: string;
  readonly #algorithms: readonly string[];

  public constructor(options: { jwksUrl: string; issuer: string; algorithms?: readonly string[]; jwks?: JWTVerifyGetKey }) {
    this.#jwks = options.jwks ?? createRemoteJWKSet(new URL(options.jwksUrl));
    this.#issuer = options.issuer;
    this.#algorithms = options.algorithms ?? ['ES256', 'RS256'];
  }

  public async verify(token: string): Promise<VerifiedUser> {
    try {
      const { payload } = await jwtVerify(token, this.#jwks, {
        issuer: this.#issuer,
        audience: 'authenticated',
        algorithms: [...this.#algorithms],
        requiredClaims: ['sub', 'exp', 'role'],
      });
      const sub = payload.sub ?? '';
      if (!UUID.test(sub) || payload['role'] !== 'authenticated' || payload['is_anonymous'] === true) throw new Error('claims');
      const email = typeof payload['email'] === 'string' ? payload['email'] : null;
      return { id: sub.toLowerCase(), email };
    } catch {
      throw new AuthError();
    }
  }
}
