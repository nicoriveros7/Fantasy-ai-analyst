import { Injectable } from '@nestjs/common';
import { access, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  FantasyBootstrapData,
  FantasyDataProvider,
  ProviderFixture,
  ProviderGameweek,
  ProviderPlayer,
  ProviderPlayerStat,
  ProviderTeam,
} from '../fantasy-data-provider.interface';

@Injectable()
export class SeedDataProvider implements FantasyDataProvider {
  readonly name = 'seed';

  async getBootstrapData(): Promise<FantasyBootstrapData> {
    const filePath = await this.resolveSeedDataPath();
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as FantasyBootstrapData;
  }

  async getTeams(): Promise<ProviderTeam[]> {
    const data = await this.getBootstrapData();
    return data.teams;
  }

  async getPlayers(): Promise<ProviderPlayer[]> {
    const data = await this.getBootstrapData();
    return data.players;
  }

  async getGameweeks(): Promise<ProviderGameweek[]> {
    const data = await this.getBootstrapData();
    return data.gameweeks;
  }

  async getFixtures(): Promise<ProviderFixture[]> {
    const data = await this.getBootstrapData();
    return data.fixtures;
  }

  async getPlayerStats(playerExternalId: number): Promise<ProviderPlayerStat[]> {
    const data = await this.getBootstrapData();
    return data.matchStats.filter((item) => item.playerExternalId === playerExternalId);
  }

  private async resolveSeedDataPath() {
    const candidates = [
      resolve(process.cwd(), 'prisma', 'seed-data.json'),
      resolve(process.cwd(), '..', 'prisma', 'seed-data.json'),
      resolve(process.cwd(), '..', '..', 'prisma', 'seed-data.json'),
    ];

    for (const candidate of candidates) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error('Unable to locate prisma/seed-data.json');
  }
}