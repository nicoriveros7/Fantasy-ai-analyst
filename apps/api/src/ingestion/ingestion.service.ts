import { Inject, Injectable } from '@nestjs/common';
import { FantasyDataProvider } from './providers/fantasy-data-provider.interface';
import { FANTASY_DATA_PROVIDER } from './providers/fantasy-data-provider.token';

@Injectable()
export class IngestionService {
  constructor(
    @Inject(FANTASY_DATA_PROVIDER)
    private readonly provider: FantasyDataProvider,
  ) {}

  async getBootstrapPreview() {
    const data = await this.provider.getBootstrapData();

    return {
      provider: this.provider.name,
      counts: {
        teams: data.teams.length,
        players: data.players.length,
        gameweeks: data.gameweeks.length,
        fixtures: data.fixtures.length,
        matchStats: data.matchStats.length,
      },
    };
  }
}