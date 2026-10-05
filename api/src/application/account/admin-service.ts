import type { AdminMetrics } from '@hook/domain';
import type { AdminRepository, Clock } from '../../ports';
import { DAY_MS } from '../time';

/** Owner-only analytics (ADR-0004). The HTTP layer hides the route from everyone else. */
export class AdminService {
  readonly #repo: AdminRepository;
  readonly #clock: Clock;
  readonly #adminIds: ReadonlySet<string>;

  public constructor(deps: { repo: AdminRepository; clock: Clock; adminUserIds: readonly string[] }) {
    this.#repo = deps.repo;
    this.#clock = deps.clock;
    this.#adminIds = new Set(deps.adminUserIds.map((id) => id.trim().toLowerCase()).filter((id) => id !== ''));
  }

  public isAdmin(userId: string): boolean {
    return this.#adminIds.has(userId.toLowerCase());
  }

  public metrics(days: number): Promise<AdminMetrics> {
    const now = this.#clock.now();
    return this.#repo.metrics(new Date(now.getTime() - days * DAY_MS), now, now);
  }
}
