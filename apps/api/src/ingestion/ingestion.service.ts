import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { IngestionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationEngineService } from '../recommendations/recommendation-engine.service';
import { SyncIngestionDto } from './dto/sync-ingestion.dto';
import { FplDataProvider } from './providers/fpl/fpl-data.provider';
import {
  FantasyDataProvider,
  ProviderFixture,
  ProviderGameweek,
  ProviderPlayer,
  ProviderPlayerStat,
  ProviderTeam,
} from './providers/fantasy-data-provider.interface';
import { FANTASY_DATA_PROVIDER } from './providers/fantasy-data-provider.token';
import { SeedDataProvider } from './providers/seed/seed-data.provider';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(FANTASY_DATA_PROVIDER)
    private readonly defaultProvider: FantasyDataProvider,
    private readonly seedProvider: SeedDataProvider,
    private readonly fplProvider: FplDataProvider,
    private readonly prisma: PrismaService,
    private readonly recommendationEngine: RecommendationEngineService,
  ) {}

  async getBootstrapPreview() {
    const provider = this.resolveProvider();
    const [teams, players, gameweeks, fixtures] = await Promise.all([
      provider.getTeams(),
      provider.getPlayers(),
      provider.getGameweeks(),
      provider.getFixtures(),
    ]);

    return {
      provider: provider.name,
      counts: {
        teams: teams.length,
        players: players.length,
        gameweeks: gameweeks.length,
        fixtures: fixtures.length,
      },
    };
  }

  async sync(payload: SyncIngestionDto) {
    const provider = this.resolveProvider(payload.source);
    const includePlayerHistory = payload.includePlayerHistory ?? true;
    const historyMode = payload.playerHistoryMode ?? (process.env.PLAYER_HISTORY_SYNC_MODE as 'top' | 'all') ?? 'top';
    const historyLimit = payload.playerHistoryLimit ?? Number(process.env.PLAYER_HISTORY_LIMIT ?? 50);

    const run = await this.prisma.ingestionRun.create({
      data: {
        source: provider.name,
        status: IngestionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const [teams, players, gameweeks, fixtures] = await Promise.all([
        provider.getTeams(),
        provider.getPlayers(),
        provider.getGameweeks(),
        provider.getFixtures(),
      ]);

      const upsertedTeams = await this.upsertTeams(teams);
      const upsertedPlayers = await this.upsertPlayers(players, upsertedTeams);
      const upsertedGameweeks = await this.upsertGameweeks(gameweeks);
      const upsertedFixtures = await this.upsertFixtures(fixtures, upsertedTeams, upsertedGameweeks);

      let syncedPlayerHistoryCount = 0;
      let upsertedMatchStats = 0;

      if (includePlayerHistory) {
        const targetPlayers = this.pickPlayersForHistory(players, historyMode, historyLimit);
        syncedPlayerHistoryCount = targetPlayers.length;

        for (const player of targetPlayers) {
          const stats = await provider.getPlayerStats(player.externalId);
          upsertedMatchStats += await this.upsertPlayerStats(stats, upsertedPlayers, upsertedFixtures);
        }
      }

      const affectedGameweeks = [...new Set(gameweeks.map((gw) => gw.number))].sort((a, b) => a - b);
      const recomputed = await this.recomputeRecommendations(affectedGameweeks);

      const recordsProcessed =
        upsertedTeams.size + upsertedPlayers.size + upsertedGameweeks.size + upsertedFixtures.size + upsertedMatchStats;

      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: IngestionStatus.SUCCESS,
          completedAt: new Date(),
          recordsProcessed,
        },
      });

      const summary = {
        runId: run.id,
        provider: provider.name,
        includePlayerHistory,
        playerHistoryMode: historyMode,
        playerHistoryLimit: historyLimit,
        counts: {
          teams: upsertedTeams.size,
          players: upsertedPlayers.size,
          gameweeks: upsertedGameweeks.size,
          fixtures: upsertedFixtures.size,
          syncedPlayerHistoryCount,
          matchStats: upsertedMatchStats,
        },
        affectedGameweeks,
        recommendationsRecomputed: recomputed,
      };

      this.logger.log(`Ingestion sync completed: ${JSON.stringify(summary)}`);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: IngestionStatus.FAILED,
          completedAt: new Date(),
          errorMessage: message,
        },
      });

      throw new BadRequestException(`Ingestion sync failed: ${message}`);
    }
  }

  private resolveProvider(source?: 'seed' | 'fpl'): FantasyDataProvider {
    const selected = source ?? ((process.env.DATA_PROVIDER as 'seed' | 'fpl' | undefined) ?? this.defaultProvider.name as 'seed' | 'fpl');
    if (selected === 'seed') {
      return this.seedProvider;
    }
    if (selected === 'fpl') {
      return this.fplProvider;
    }
    throw new BadRequestException(`Unsupported data provider: ${selected}`);
  }

  private pickPlayersForHistory(players: ProviderPlayer[], mode: 'top' | 'all', limit: number): ProviderPlayer[] {
    if (mode === 'all') {
      return players;
    }

    return [...players]
      .sort((a, b) => {
        const minutesDelta = b.minutesSeason - a.minutesSeason;
        if (minutesDelta !== 0) {
          return minutesDelta;
        }
        return (b.form ?? 0) - (a.form ?? 0);
      })
      .slice(0, limit);
  }

  private async upsertTeams(teams: ProviderTeam[]) {
    const map = new Map<number, number>();
    for (const team of teams) {
      const saved = await this.prisma.team.upsert({
        where: { externalId: team.externalId },
        create: {
          externalId: team.externalId,
          name: team.name,
          shortName: team.shortName,
          strengthAttack: team.strengthAttack,
          strengthDefense: team.strengthDefense,
        },
        update: {
          name: team.name,
          shortName: team.shortName,
          strengthAttack: team.strengthAttack,
          strengthDefense: team.strengthDefense,
        },
        select: { id: true, externalId: true },
      });
      map.set(saved.externalId, saved.id);
    }
    return map;
  }

  private async upsertPlayers(players: ProviderPlayer[], teamMap: Map<number, number>) {
    const map = new Map<number, number>();
    for (const player of players) {
      const teamId = teamMap.get(player.teamExternalId);
      if (!teamId) {
        continue;
      }

      const saved = await this.prisma.player.upsert({
        where: { externalId: player.externalId },
        create: {
          externalId: player.externalId,
          teamId,
          firstName: player.firstName,
          lastName: player.lastName,
          displayName: player.displayName,
          position: player.position,
          price: player.price,
          ownershipPct: player.ownershipPct,
          status: player.status,
          minutesSeason: player.minutesSeason,
          selectedByPct: player.selectedByPct,
        },
        update: {
          teamId,
          firstName: player.firstName,
          lastName: player.lastName,
          displayName: player.displayName,
          position: player.position,
          price: player.price,
          ownershipPct: player.ownershipPct,
          status: player.status,
          minutesSeason: player.minutesSeason,
          selectedByPct: player.selectedByPct,
        },
        select: { id: true, externalId: true },
      });
      map.set(saved.externalId, saved.id);
    }
    return map;
  }

  private async upsertGameweeks(gameweeks: ProviderGameweek[]) {
    const map = new Map<number, number>();
    for (const gameweek of gameweeks) {
      const saved = await this.prisma.gameweek.upsert({
        where: { externalId: gameweek.externalId },
        create: {
          externalId: gameweek.externalId,
          number: gameweek.number,
          deadlineAt: new Date(gameweek.deadlineAt),
          isCurrent: gameweek.isCurrent,
          isFinished: gameweek.isFinished,
        },
        update: {
          number: gameweek.number,
          deadlineAt: new Date(gameweek.deadlineAt),
          isCurrent: gameweek.isCurrent,
          isFinished: gameweek.isFinished,
        },
        select: { id: true, externalId: true },
      });
      map.set(saved.externalId, saved.id);
    }
    return map;
  }

  private async upsertFixtures(
    fixtures: ProviderFixture[],
    teamMap: Map<number, number>,
    gameweekMap: Map<number, number>,
  ) {
    const map = new Map<number, number>();
    for (const fixture of fixtures) {
      const homeTeamId = teamMap.get(fixture.homeTeamExternalId);
      const awayTeamId = teamMap.get(fixture.awayTeamExternalId);
      const gameweekId = gameweekMap.get(fixture.gameweekExternalId);
      if (!homeTeamId || !awayTeamId || !gameweekId) {
        continue;
      }

      const saved = await this.prisma.fixture.upsert({
        where: { externalId: fixture.externalId },
        create: {
          externalId: fixture.externalId,
          gameweekId,
          homeTeamId,
          awayTeamId,
          kickoffAt: new Date(fixture.kickoffAt),
          homeDifficulty: fixture.homeDifficulty,
          awayDifficulty: fixture.awayDifficulty,
          isFinished: fixture.isFinished,
        },
        update: {
          gameweekId,
          homeTeamId,
          awayTeamId,
          kickoffAt: new Date(fixture.kickoffAt),
          homeDifficulty: fixture.homeDifficulty,
          awayDifficulty: fixture.awayDifficulty,
          isFinished: fixture.isFinished,
        },
        select: { id: true, externalId: true },
      });
      map.set(saved.externalId, saved.id);
    }
    return map;
  }

  private async upsertPlayerStats(
    stats: ProviderPlayerStat[],
    playerMap: Map<number, number>,
    fixtureMap: Map<number, number>,
  ) {
    let processed = 0;
    for (const stat of stats) {
      const playerId = playerMap.get(stat.playerExternalId);
      const fixtureId = fixtureMap.get(stat.fixtureExternalId);
      if (!playerId || !fixtureId) {
        continue;
      }

      await this.prisma.matchStat.upsert({
        where: {
          playerId_fixtureId: {
            playerId,
            fixtureId,
          },
        },
        create: {
          playerId,
          fixtureId,
          minutes: stat.minutes,
          goals: stat.goals,
          assists: stat.assists,
          cleanSheet: stat.cleanSheet,
          xg: stat.xg,
          xa: stat.xa,
          shots: stat.shots,
          keyPasses: stat.keyPasses,
          yellowCards: stat.yellowCards,
          redCards: stat.redCards,
          saves: stat.saves,
          bonus: stat.bonus,
          fantasyPoints: stat.fantasyPoints,
        },
        update: {
          minutes: stat.minutes,
          goals: stat.goals,
          assists: stat.assists,
          cleanSheet: stat.cleanSheet,
          xg: stat.xg,
          xa: stat.xa,
          shots: stat.shots,
          keyPasses: stat.keyPasses,
          yellowCards: stat.yellowCards,
          redCards: stat.redCards,
          saves: stat.saves,
          bonus: stat.bonus,
          fantasyPoints: stat.fantasyPoints,
        },
      });
      processed += 1;
    }

    return processed;
  }

  private async recomputeRecommendations(gameweeks: number[]) {
    let successfulRuns = 0;
    for (const gameweek of gameweeks) {
      for (const flavor of ['captain', 'differential', 'transfer'] as const) {
        try {
          await this.recommendationEngine.getRecommendations(flavor, gameweek, 5);
          successfulRuns += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(
            `Recommendation recompute skipped for ${flavor} gw ${gameweek}: ${reason}`,
          );
        }
      }
    }
    return successfulRuns;
  }
}