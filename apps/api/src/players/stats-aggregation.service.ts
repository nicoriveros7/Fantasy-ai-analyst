import { Injectable } from '@nestjs/common';

export interface AggregationInputMatch {
  minutes: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  shots: number;
  fantasyPoints: number;
}

@Injectable()
export class StatsAggregationService {
  last5MatchesStats(matches: AggregationInputMatch[]) {
    const sample = matches.slice(0, 5);
    const count = sample.length;

    const totals = sample.reduce(
      (acc, item) => {
        acc.minutes += item.minutes;
        acc.goals += item.goals;
        acc.assists += item.assists;
        acc.xg += item.xg;
        acc.xa += item.xa;
        acc.shots += item.shots;
        acc.fantasyPoints += item.fantasyPoints;
        return acc;
      },
      {
        minutes: 0,
        goals: 0,
        assists: 0,
        xg: 0,
        xa: 0,
        shots: 0,
        fantasyPoints: 0,
      },
    );

    const divisor = count || 1;

    return {
      sampleSize: count,
      totals,
      averages: {
        minutes: Number((totals.minutes / divisor).toFixed(2)),
        goals: Number((totals.goals / divisor).toFixed(2)),
        assists: Number((totals.assists / divisor).toFixed(2)),
        xg: Number((totals.xg / divisor).toFixed(3)),
        xa: Number((totals.xa / divisor).toFixed(3)),
        shots: Number((totals.shots / divisor).toFixed(2)),
        fantasyPoints: Number((totals.fantasyPoints / divisor).toFixed(2)),
      },
    };
  }

  formScore(matches: AggregationInputMatch[]) {
    const stats = this.last5MatchesStats(matches);
    const { totals, averages } = stats;

    const attackingOutput = totals.goals * 12 + totals.assists * 9;
    const expectedOutput = totals.xg * 18 + totals.xa * 14;
    const shotVolume = totals.shots * 1.2;
    const minutesStability = Math.min(20, (averages.minutes / 90) * 20);
    const pointsTrend = averages.fantasyPoints * 6;

    const score = Math.min(
      100,
      attackingOutput + expectedOutput + shotVolume + minutesStability + pointsTrend,
    );

    return Number(score.toFixed(2));
  }
}