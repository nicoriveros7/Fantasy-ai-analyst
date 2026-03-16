import {
  SeedFixture,
  SeedGameweek,
  SeedMatchStat,
  SeedPlayer,
  SeedTeam,
} from './seed/seed-data.types';

export interface ProviderTeam extends SeedTeam {}
export interface ProviderPlayer extends SeedPlayer {
  form?: number;
}
export interface ProviderGameweek extends SeedGameweek {}
export interface ProviderFixture extends SeedFixture {}
export interface ProviderPlayerStat extends SeedMatchStat {}

export interface FantasyBootstrapData {
  teams: ProviderTeam[];
  players: ProviderPlayer[];
  gameweeks: ProviderGameweek[];
  fixtures: ProviderFixture[];
  matchStats: ProviderPlayerStat[];
}

export interface FantasyDataProvider {
  name: string;
  getTeams(): Promise<ProviderTeam[]>;
  getPlayers(): Promise<ProviderPlayer[]>;
  getGameweeks(): Promise<ProviderGameweek[]>;
  getFixtures(): Promise<ProviderFixture[]>;
  getPlayerStats(playerExternalId: number): Promise<ProviderPlayerStat[]>;

  getBootstrapData?(): Promise<FantasyBootstrapData>;
}