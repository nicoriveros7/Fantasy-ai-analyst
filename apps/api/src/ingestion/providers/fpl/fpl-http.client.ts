import { Injectable } from '@nestjs/common';
import {
  FplBootstrapStaticResponse,
  FplElementSummaryResponse,
  FplFixtureResponseItem,
} from './fpl.types';

@Injectable()
export class FplHttpClient {
  private readonly baseUrl = (process.env.FPL_BASE_URL ?? 'https://fantasy.premierleague.com').replace(
    /\/$/,
    '',
  );

  async getBootstrapStatic(): Promise<FplBootstrapStaticResponse> {
    return this.getJson<FplBootstrapStaticResponse>('/api/bootstrap-static/');
  }

  async getFixtures(): Promise<FplFixtureResponseItem[]> {
    return this.getJson<FplFixtureResponseItem[]>('/api/fixtures/');
  }

  async getElementSummary(elementId: number): Promise<FplElementSummaryResponse> {
    return this.getJson<FplElementSummaryResponse>(`/api/element-summary/${elementId}/`);
  }

  private async getJson<T>(path: string): Promise<T> {
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`FPL ${path} failed (${response.status}): ${body.slice(0, 300)}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown FPL request error');
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }

    throw new Error(`FPL request failed for ${path}: ${lastError?.message ?? 'unknown error'}`);
  }
}
