import { Injectable } from '@nestjs/common';
import { access, readFile } from 'fs/promises';
import { resolve } from 'path';
import { FantasyBootstrapData, FantasyDataProvider } from '../fantasy-data-provider.interface';

@Injectable()
export class SeedDataProvider implements FantasyDataProvider {
  readonly name = 'seed';

  async getBootstrapData(): Promise<FantasyBootstrapData> {
    const filePath = await this.resolveSeedDataPath();
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as FantasyBootstrapData;
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