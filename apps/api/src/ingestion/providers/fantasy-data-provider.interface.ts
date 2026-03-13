import {
  SeedFixture,
  SeedGameweek,
  SeedMatchStat,
  SeedPlayer,
  SeedTeam,
} from './seed/seed-data.types';

export interface FantasyBootstrapData {
  teams: SeedTeam[];
  players: SeedPlayer[];
  gameweeks: SeedGameweek[];
  fixtures: SeedFixture[];
  matchStats: SeedMatchStat[];
}

export interface FantasyDataProvider {
  name: string;
  getBootstrapData(): Promise<FantasyBootstrapData>;
}