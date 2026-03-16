import { Injectable } from '@nestjs/common';
import {
  FantasyDataProvider,
  ProviderFixture,
  ProviderGameweek,
  ProviderPlayer,
  ProviderPlayerStat,
  ProviderTeam,
} from '../fantasy-data-provider.interface';
import { FplHttpClient } from './fpl-http.client';
import { FplMapper } from './fpl.mapper';

@Injectable()
export class FplDataProvider implements FantasyDataProvider {
  readonly name = 'fpl';

  private bootstrapCache: {
    teams: ProviderTeam[];
    players: ProviderPlayer[];
    gameweeks: ProviderGameweek[];
    fetchedAt: number;
  } | null = null;

  constructor(private readonly client: FplHttpClient) {}

  async getTeams(): Promise<ProviderTeam[]> {
    const bootstrap = await this.getBootstrap();
    return bootstrap.teams;
  }

  async getPlayers(): Promise<ProviderPlayer[]> {
    const bootstrap = await this.getBootstrap();
    return bootstrap.players;
  }

  async getGameweeks(): Promise<ProviderGameweek[]> {
    const bootstrap = await this.getBootstrap();
    return bootstrap.gameweeks;
  }

  async getFixtures(): Promise<ProviderFixture[]> {
    const fixtures = await this.client.getFixtures();
    return FplMapper.mapFixtures(fixtures);
  }

  async getPlayerStats(playerExternalId: number): Promise<ProviderPlayerStat[]> {
    const summary = await this.client.getElementSummary(playerExternalId);
    return FplMapper.mapPlayerStats(playerExternalId, summary);
  }

  private async getBootstrap() {
    const cacheTtlMs = 60_000;
    if (this.bootstrapCache && Date.now() - this.bootstrapCache.fetchedAt < cacheTtlMs) {
      return this.bootstrapCache;
    }

    const response = await this.client.getBootstrapStatic();
    this.bootstrapCache = {
      teams: FplMapper.mapTeams(response),
      players: FplMapper.mapPlayers(response),
      gameweeks: FplMapper.mapGameweeks(response),
      fetchedAt: Date.now(),
    };
    return this.bootstrapCache;
  }
}
