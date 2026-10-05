import { THIS_PRODUCT, type HistoryItem } from '@hook/domain';
import type { Clock, GenerationRepository } from '../../ports';
import { DAY_MS } from '../time';
import { RETENTION_DAYS } from './hook-generation-service';

/** "This month's history": the last 30 days of generations (PRD A6.4). */
export class HistoryService {
  readonly #generations: GenerationRepository;
  readonly #clock: Clock;

  public constructor(generations: GenerationRepository, clock: Clock) {
    this.#generations = generations;
    this.#clock = clock;
  }

  public async recent(userId: string, limit = 50): Promise<HistoryItem[]> {
    const since = new Date(this.#clock.now().getTime() - RETENTION_DAYS * DAY_MS);
    const records = await this.#generations.listSince(userId, THIS_PRODUCT, since, limit);
    return records.map((r) => ({
      id: r.id,
      feature: r.feature,
      createdAt: r.createdAt.toISOString(),
      title: r.title,
      output: r.output,
    }));
  }
}
