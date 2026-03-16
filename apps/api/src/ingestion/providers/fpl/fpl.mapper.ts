import {
  ProviderFixture,
  ProviderGameweek,
  ProviderPlayer,
  ProviderPlayerStat,
  ProviderTeam,
} from '../fantasy-data-provider.interface';
import {
  FplBootstrapStaticResponse,
  FplElementSummaryResponse,
  FplFixtureResponseItem,
} from './fpl.types';

const positionMap: Record<number, ProviderPlayer['position']> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

export class FplMapper {
  static mapTeams(bootstrap: FplBootstrapStaticResponse): ProviderTeam[] {
    return bootstrap.teams.map((team) => ({
      externalId: team.id,
      name: team.name,
      shortName: team.short_name,
      strengthAttack: team.strength_attack_home,
      strengthDefense: team.strength_defence_home,
    }));
  }

  static mapPlayers(bootstrap: FplBootstrapStaticResponse): ProviderPlayer[] {
    return bootstrap.elements.map((player) => ({
      externalId: player.id,
      teamExternalId: player.team,
      firstName: player.first_name,
      lastName: player.second_name,
      displayName: player.web_name,
      position: positionMap[player.element_type] ?? 'MID',
      price: player.now_cost / 10,
      ownershipPct: Number(player.selected_by_percent) || 0,
      status: player.status,
      minutesSeason: player.minutes,
      selectedByPct: Number(player.selected_by_percent) || 0,
      form: Number(player.form) || 0,
    }));
  }

  static mapGameweeks(bootstrap: FplBootstrapStaticResponse): ProviderGameweek[] {
    return bootstrap.events.map((event) => ({
      externalId: event.id,
      number: event.id,
      deadlineAt: event.deadline_time,
      isCurrent: event.is_current,
      isFinished: event.finished,
    }));
  }

  static mapFixtures(fixtures: FplFixtureResponseItem[]): ProviderFixture[] {
    return fixtures
      .filter((fixture) => fixture.event !== null)
      .map((fixture) => ({
        externalId: fixture.id,
        gameweekExternalId: fixture.event as number,
        homeTeamExternalId: fixture.team_h,
        awayTeamExternalId: fixture.team_a,
        kickoffAt: fixture.kickoff_time ?? new Date().toISOString(),
        homeDifficulty: fixture.team_h_difficulty,
        awayDifficulty: fixture.team_a_difficulty,
        isFinished: fixture.finished,
      }));
  }

  static mapPlayerStats(
    playerExternalId: number,
    summary: FplElementSummaryResponse,
  ): ProviderPlayerStat[] {
    return summary.history.map((entry) => ({
      playerExternalId,
      fixtureExternalId: entry.fixture,
      minutes: entry.minutes,
      goals: entry.goals_scored,
      assists: entry.assists,
      cleanSheet: entry.clean_sheets > 0,
      xg: Number(entry.expected_goals) || 0,
      xa: Number(entry.expected_assists) || 0,
      shots: 0,
      keyPasses: 0,
      yellowCards: entry.yellow_cards,
      redCards: entry.red_cards,
      saves: entry.saves,
      bonus: entry.bonus,
      fantasyPoints: entry.total_points,
    }));
  }
}
