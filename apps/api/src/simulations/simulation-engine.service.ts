import { BadRequestException, Injectable } from '@nestjs/common';
import {
  HeadToHeadSimulationResult,
  PlayerSimulationContext,
  PlayerSimulationResult,
} from './types/simulation.types';

@Injectable()
export class SimulationEngineService {
  simulatePlayerDistribution(
    player: PlayerSimulationContext,
    numSimulations: number,
    randomSeed?: number,
    horizon: 1 | 3 | 5 = 1,
  ): PlayerSimulationResult {
    this.validateSimulations(numSimulations);
    const seed = randomSeed ?? 123456;
    const rng = this.createRng(seed ^ 0xa24baed4);
    const samples = this.simulateSamples(player, numSimulations, rng, horizon);

    return {
      playerId: player.playerId,
      samples,
      summary: this.summarize(samples),
    };
  }

  simulateHeadToHead(
    playerA: PlayerSimulationContext,
    playerB: PlayerSimulationContext,
    numSimulations: number,
    randomSeed?: number,
  ): HeadToHeadSimulationResult {
    this.validateSimulations(numSimulations);
    const seed = randomSeed ?? 123456;

    const rngA = this.createRng(seed ^ 0x9e3779b9);
    const rngB = this.createRng(seed ^ 0x85ebca6b);

    const samplesA = this.simulateSamples(playerA, numSimulations, rngA);
    const samplesB = this.simulateSamples(playerB, numSimulations, rngB);

    let winsA = 0;
    for (let i = 0; i < numSimulations; i += 1) {
      if (samplesA[i] > samplesB[i]) {
        winsA += 1;
      }
    }

    return {
      playerA: {
        playerId: playerA.playerId,
        samples: samplesA,
        summary: this.summarize(samplesA),
      },
      playerB: {
        playerId: playerB.playerId,
        samples: samplesB,
        summary: this.summarize(samplesB),
      },
      probabilityAOutscoresB: this.round(winsA / numSimulations),
    };
  }

  simulateGainDistribution(
    baseline: PlayerSimulationContext,
    replacement: PlayerSimulationContext,
    horizon: 3 | 5,
    numSimulations: number,
    randomSeed?: number,
  ) {
    this.validateSimulations(numSimulations);
    const seed = randomSeed ?? 123456;

    const baseRng = this.createRng(seed ^ 0x27d4eb2f);
    const inRng = this.createRng(seed ^ 0x165667b1);

    const baselineSamples = this.simulateSamples(baseline, numSimulations, baseRng, horizon);
    const replacementSamples = this.simulateSamples(replacement, numSimulations, inRng, horizon);

    const gains: number[] = [];
    let transferBeats = 0;
    for (let i = 0; i < numSimulations; i += 1) {
      const gain = replacementSamples[i] - baselineSamples[i];
      gains.push(gain);
      if (gain > 0) {
        transferBeats += 1;
      }
    }

    return {
      gains,
      probabilityTransferBeatsNoTransfer: this.round(transferBeats / numSimulations),
      gainSummary: this.summarize(gains),
      noTransferSummary: this.summarize(baselineSamples),
      transferSummary: this.summarize(replacementSamples),
    };
  }

  private simulateSamples(
    context: PlayerSimulationContext,
    numSimulations: number,
    rng: () => number,
    horizon = 1,
  ) {
    const samples: number[] = [];

    const minutePenalty = context.minutesReliability < 6 ? 0.82 : 1;
    const fixtureVolatility = 0.7 + ((10 - context.fixtureDifficulty) / 10) * 0.6;
    const attackVolatility = 0.35 + (context.xgTrend / 10) * 0.5 + (context.xaTrend / 10) * 0.2;
    const sigmaBase = Math.max(0.9, context.expectedPoints * (0.16 + attackVolatility * 0.18));

    for (let i = 0; i < numSimulations; i += 1) {
      let total = 0;

      for (let gw = 0; gw < horizon; gw += 1) {
        const noise = this.normal(rng) * sigmaBase * fixtureVolatility;
        let points = context.expectedPoints + noise;

        if (context.isBlank) {
          points *= 0.1;
        }
        if (context.isDouble) {
          points *= 1.45;
        }

        points *= minutePenalty;
        points = Math.max(0, points);
        total += points;
      }

      samples.push(this.round(total));
    }

    return samples;
  }

  private summarize(samples: number[]) {
    const sorted = [...samples].sort((a, b) => a - b);
    const expectedValue = sorted.reduce((acc, value) => acc + value, 0) / sorted.length;

    return {
      expectedValue: this.round(expectedValue),
      median: this.quantile(sorted, 0.5),
      upsideScore: this.quantile(sorted, 0.9),
      downsideRisk: this.round(this.quantile(sorted, 0.1)),
      p10: this.quantile(sorted, 0.1),
      p25: this.quantile(sorted, 0.25),
      p75: this.quantile(sorted, 0.75),
      p90: this.quantile(sorted, 0.9),
    };
  }

  private quantile(sortedValues: number[], q: number) {
    if (!sortedValues.length) {
      return 0;
    }

    const idx = (sortedValues.length - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      return this.round(sortedValues[lo]);
    }

    const weight = idx - lo;
    return this.round(sortedValues[lo] * (1 - weight) + sortedValues[hi] * weight);
  }

  private validateSimulations(numSimulations: number) {
    if (!Number.isInteger(numSimulations) || numSimulations < 100 || numSimulations > 50000) {
      throw new BadRequestException('numSimulations must be an integer between 100 and 50000');
    }
  }

  private createRng(seedInput: number) {
    let seed = seedInput >>> 0;
    if (seed === 0) {
      seed = 0x6d2b79f5;
    }

    return () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private normal(rng: () => number) {
    let u = 0;
    let v = 0;
    while (u === 0) {
      u = rng();
    }
    while (v === 0) {
      v = rng();
    }
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private round(value: number) {
    return Number(value.toFixed(4));
  }
}
