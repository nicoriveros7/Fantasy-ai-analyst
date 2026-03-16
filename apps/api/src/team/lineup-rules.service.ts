import { Injectable } from '@nestjs/common';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

interface LineupPlayer {
  playerId: number;
  position: Position;
}

@Injectable()
export class LineupRulesService {
  validateLineup(startingXI: LineupPlayer[], benchOrder: LineupPlayer[]) {
    const errors: string[] = [];

    if (startingXI.length !== 11) {
      errors.push('Starting XI must contain exactly 11 players');
    }

    if (benchOrder.length !== 4) {
      errors.push('Bench must contain exactly 4 players');
    }

    const allIds = [...startingXI.map((p) => p.playerId), ...benchOrder.map((p) => p.playerId)];
    if (new Set(allIds).size !== allIds.length) {
      errors.push('Starting XI and bench contain duplicate players');
    }

    const starterCounts = this.countByPosition(startingXI);
    if (starterCounts.GK !== 1) {
      errors.push('Starting XI must contain exactly 1 goalkeeper');
    }
    if (starterCounts.DEF < 3) {
      errors.push('Starting XI must contain at least 3 defenders');
    }
    if (starterCounts.MID < 2) {
      errors.push('Starting XI must contain at least 2 midfielders');
    }
    if (starterCounts.FWD < 1) {
      errors.push('Starting XI must contain at least 1 forward');
    }

    const benchCounts = this.countByPosition(benchOrder);
    if (benchCounts.GK !== 1) {
      errors.push('Bench must contain exactly 1 goalkeeper');
    }

    const benchLast = benchOrder[benchOrder.length - 1];
    if (!benchLast || benchLast.position !== 'GK') {
      errors.push('Bench order must place goalkeeper last');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private countByPosition(players: LineupPlayer[]) {
    return players.reduce(
      (acc, player) => {
        acc[player.position] += 1;
        return acc;
      },
      {
        GK: 0,
        DEF: 0,
        MID: 0,
        FWD: 0,
      } as Record<Position, number>,
    );
  }
}
