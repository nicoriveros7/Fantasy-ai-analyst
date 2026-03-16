import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpectedPointsService } from './expected-points.service';
import { LineupRulesService } from './lineup-rules.service';
import { SquadRulesService } from './squad-rules.service';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

interface SquadProjection {
  id: number;
  displayName: string;
  position: Position;
  expectedPoints: number;
}

@Injectable()
export class LineupOptimizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectedPointsService: ExpectedPointsService,
    private readonly squadRulesService: SquadRulesService,
    private readonly lineupRulesService: LineupRulesService,
  ) {}

  async optimizeLineup(squadPlayerIds: number[], gameweekNumber: number) {
    const squadValidation = await this.squadRulesService.validateSquad(squadPlayerIds);
    if (!squadValidation.isValid) {
      throw new BadRequestException(squadValidation.errors.join('; '));
    }

    const uniqueIds = [...new Set(squadPlayerIds)];

    const players = await this.prisma.player.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        displayName: true,
        position: true,
      },
    });

    if (players.length !== 15) {
      throw new BadRequestException('Some squad players were not found');
    }

    const projections: SquadProjection[] = await Promise.all(
      players.map(async (player) => ({
        id: player.id,
        displayName: player.displayName,
        position: player.position,
        expectedPoints: await this.expectedPointsService.expectedPoints(player.id, gameweekNumber),
      })),
    );

    const gks = projections.filter((player) => player.position === 'GK').sort(this.byExpectedDesc);
    const defs = projections.filter((player) => player.position === 'DEF').sort(this.byExpectedDesc);
    const mids = projections.filter((player) => player.position === 'MID').sort(this.byExpectedDesc);
    const fwds = projections.filter((player) => player.position === 'FWD').sort(this.byExpectedDesc);

    if (!gks.length || defs.length < 3 || mids.length < 2 || fwds.length < 1) {
      throw new BadRequestException('Squad does not satisfy minimum formation requirements');
    }

    const formations: Array<{ def: number; mid: number; fwd: number }> = [];
    for (let def = 3; def <= 5; def += 1) {
      for (let mid = 2; mid <= 5; mid += 1) {
        for (let fwd = 1; fwd <= 3; fwd += 1) {
          if (def + mid + fwd === 10) {
            formations.push({ def, mid, fwd });
          }
        }
      }
    }

    const startingGoalkeeper = gks[0];
    let bestStarters: SquadProjection[] = [];
    let bestFormation = formations[0];
    let bestScore = -1;

    for (const formation of formations) {
      if (defs.length < formation.def || mids.length < formation.mid || fwds.length < formation.fwd) {
        continue;
      }

      const starters = [
        startingGoalkeeper,
        ...defs.slice(0, formation.def),
        ...mids.slice(0, formation.mid),
        ...fwds.slice(0, formation.fwd),
      ];
      const score = starters.reduce((acc, player) => acc + player.expectedPoints, 0);

      if (score > bestScore) {
        bestScore = score;
        bestStarters = starters;
        bestFormation = formation;
      }
    }

    if (!bestStarters.length) {
      throw new BadRequestException('Unable to build a valid starting XI from this squad');
    }

    const starterIds = new Set(bestStarters.map((player) => player.id));
    const bench = projections
      .filter((player) => !starterIds.has(player.id))
      .sort((a, b) => {
        if (a.position === 'GK' && b.position !== 'GK') {
          return 1;
        }
        if (a.position !== 'GK' && b.position === 'GK') {
          return -1;
        }
        return b.expectedPoints - a.expectedPoints;
      });

    const startersSorted = [...bestStarters].sort(this.byExpectedDesc);
    const captain = startersSorted[0];
    const viceCaptain = startersSorted[1];

    const expectedTotalPoints = Number(
      (
        bestStarters.reduce((acc, player) => acc + player.expectedPoints, 0) +
        (captain?.expectedPoints ?? 0)
      ).toFixed(2),
    );

    const lineupValidation = this.lineupRulesService.validateLineup(
      bestStarters.map((player) => ({ playerId: player.id, position: player.position })),
      bench.map((player) => ({ playerId: player.id, position: player.position })),
    );
    if (!lineupValidation.isValid) {
      throw new BadRequestException(lineupValidation.errors.join('; '));
    }

    return {
      gameweek: gameweekNumber,
      formation: `${bestFormation.def}-${bestFormation.mid}-${bestFormation.fwd}`,
      startingXI: bestStarters.map((player) => ({
        playerId: player.id,
        name: player.displayName,
        position: player.position,
        expectedPoints: player.expectedPoints,
      })),
      captain: captain
        ? {
            playerId: captain.id,
            name: captain.displayName,
            expectedPoints: captain.expectedPoints,
          }
        : null,
      viceCaptain: viceCaptain
        ? {
            playerId: viceCaptain.id,
            name: viceCaptain.displayName,
            expectedPoints: viceCaptain.expectedPoints,
          }
        : null,
      benchOrder: bench.map((player) => ({
        playerId: player.id,
        name: player.displayName,
        position: player.position,
        expectedPoints: player.expectedPoints,
      })),
      expectedTotalPoints,
    };
  }

  private byExpectedDesc(a: SquadProjection, b: SquadProjection) {
    return b.expectedPoints - a.expectedPoints;
  }
}
