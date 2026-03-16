import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpectedPointsService } from './expected-points.service';
import { SquadRulesService } from './squad-rules.service';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

interface CandidatePlayer {
  id: number;
  displayName: string;
  position: Position;
  price: number;
  teamId: number;
  expectedPoints: number;
}

@Injectable()
export class TransferSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectedPointsService: ExpectedPointsService,
    private readonly squadRulesService: SquadRulesService,
  ) {}

  async suggestTransfers(
    squadPlayerIds: number[],
    budget: number,
    freeTransfers: number,
    gameweekNumber: number,
    horizon: 1 | 3 | 5,
  ) {
    const squadValidation = await this.squadRulesService.validateSquad(squadPlayerIds);
    if (!squadValidation.isValid) {
      throw new BadRequestException(squadValidation.errors.join('; '));
    }

    const uniqueIds = [...new Set(squadPlayerIds)];

    const squad = await this.prisma.player.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        displayName: true,
        position: true,
        price: true,
        teamId: true,
      },
    });

    if (squad.length !== 15) {
      throw new BadRequestException('Some squad players were not found');
    }

    const squadSet = new Set(uniqueIds);
    const candidateRaw = await this.prisma.player.findMany({
      where: {
        id: { notIn: uniqueIds },
        status: 'a',
      },
      orderBy: [{ minutesSeason: 'desc' }],
      take: 250,
      select: {
        id: true,
        displayName: true,
        position: true,
        price: true,
        teamId: true,
      },
    });

    const [squadWithProjection, candidates] = await Promise.all([
      Promise.all(
        squad.map(async (player) => ({
          ...player,
          price: Number(player.price),
          expectedPoints: await this.expectedPointsService.expectedPointsOverHorizon(
            player.id,
            gameweekNumber,
            horizon,
          ),
        })),
      ),
      Promise.all(
        candidateRaw.map(async (player) => ({
          id: player.id,
          displayName: player.displayName,
          position: player.position,
          price: Number(player.price),
          teamId: player.teamId,
          expectedPoints: await this.expectedPointsService.expectedPointsOverHorizon(
            player.id,
            gameweekNumber,
            horizon,
          ),
        })),
      ),
    ]);

    const transfers: Array<{
      out: CandidatePlayer;
      in: CandidatePlayer;
      projectedPointGain: number;
      budgetImpact: number;
    }> = [];

    let remainingBudget = budget;
    const mutableSquad = [...squadWithProjection];
    const teamCount = new Map<number, number>();
    for (const player of mutableSquad) {
      teamCount.set(player.teamId, (teamCount.get(player.teamId) ?? 0) + 1);
    }

    for (let transferSlot = 0; transferSlot < freeTransfers; transferSlot += 1) {
      let best:
        | {
            out: CandidatePlayer;
            in: CandidatePlayer;
            gain: number;
            budgetImpact: number;
          }
        | null = null;

      for (const outPlayer of mutableSquad) {
        const validTargets = candidates.filter(
          (target) =>
            !squadSet.has(target.id) &&
            target.position === outPlayer.position &&
            target.price <= outPlayer.price + remainingBudget &&
            this.respectsClubLimit(teamCount, outPlayer.teamId, target.teamId),
        );

        for (const target of validTargets) {
          const gain = Number((target.expectedPoints - outPlayer.expectedPoints).toFixed(2));
          if (gain <= 0) {
            continue;
          }

          const budgetImpact = Number((target.price - outPlayer.price).toFixed(2));
          if (!best || gain > best.gain) {
            best = {
              out: outPlayer,
              in: target,
              gain,
              budgetImpact,
            };
          }
        }
      }

      if (!best) {
        break;
      }

      transfers.push({
        out: best.out,
        in: best.in,
        projectedPointGain: best.gain,
        budgetImpact: best.budgetImpact,
      });

      remainingBudget = Number((remainingBudget - best.budgetImpact).toFixed(2));

      const outIndex = mutableSquad.findIndex((item) => item.id === best!.out.id);
      if (outIndex >= 0) {
        mutableSquad.splice(outIndex, 1, best.in);
      }
      teamCount.set(best.out.teamId, Math.max(0, (teamCount.get(best.out.teamId) ?? 1) - 1));
      teamCount.set(best.in.teamId, (teamCount.get(best.in.teamId) ?? 0) + 1);
      squadSet.delete(best.out.id);
      squadSet.add(best.in.id);
    }

    const postValidation = await this.squadRulesService.validateSquad([...squadSet]);
    if (!postValidation.isValid) {
      throw new BadRequestException(`Transfer output invalid squad: ${postValidation.errors.join('; ')}`);
    }

    const projectedPointGain = Number(
      transfers.reduce((acc, transfer) => acc + transfer.projectedPointGain, 0).toFixed(2),
    );

    return {
      gameweek: gameweekNumber,
      horizon,
      requestedFreeTransfers: freeTransfers,
      usedFreeTransfers: transfers.length,
      remainingBudget,
      projectedPointGain,
      recommendedTransfers: transfers.map((transfer) => ({
        out: {
          playerId: transfer.out.id,
          name: transfer.out.displayName,
          price: transfer.out.price,
          expectedPoints: transfer.out.expectedPoints,
        },
        in: {
          playerId: transfer.in.id,
          name: transfer.in.displayName,
          price: transfer.in.price,
          expectedPoints: transfer.in.expectedPoints,
        },
        projectedPointGain: transfer.projectedPointGain,
        budgetImpact: transfer.budgetImpact,
      })),
    };
  }

  private respectsClubLimit(teamCount: Map<number, number>, outgoingTeamId: number, incomingTeamId: number) {
    if (outgoingTeamId === incomingTeamId) {
      return true;
    }

    const incomingCount = teamCount.get(incomingTeamId) ?? 0;
    return incomingCount < 3;
  }
}
