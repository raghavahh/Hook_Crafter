import type { IdentityAdmin } from '../../ports';

/** Deletes the Supabase Auth user with the service key (Worker secret only). */
export class SupabaseIdentityAdmin implements IdentityAdmin {
  readonly #url: string;
  readonly #serviceKey: string;
  readonly #fetch: typeof fetch;

  public constructor(options: { url: string; serviceKey: string; fetchImpl?: typeof fetch }) {
    this.#url = options.url.replace(/\/$/u, '');
    this.#serviceKey = options.serviceKey;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  public async deleteUser(userId: string): Promise<void> {
    const response = await this.#fetch(`${this.#url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { apikey: this.#serviceKey, authorization: `Bearer ${this.#serviceKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) throw new Error(`auth admin delete failed: ${String(response.status)}`);
  }
}
