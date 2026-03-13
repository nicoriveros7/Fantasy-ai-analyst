export interface SeedTeam {
  externalId: number;
  name: string;
  shortName: string;
  strengthAttack: number;
  strengthDefense: number;
}

export interface SeedPlayer {
  externalId: number;
  teamExternalId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  ownershipPct: number;
  status: string;
  minutesSeason: number;
  selectedByPct: number;
}

export interface SeedGameweek {
  externalId: number;
  number: number;
  deadlineAt: string;
  isCurrent: boolean;
  isFinished: boolean;
}

export interface SeedFixture {
  externalId: number;
  gameweekExternalId: number;
  homeTeamExternalId: number;
  awayTeamExternalId: number;
  kickoffAt: string;
  homeDifficulty: number;
  awayDifficulty: number;
  isFinished: boolean;
}

export interface SeedMatchStat {
  playerExternalId: number;
  fixtureExternalId: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  xg: number;
  xa: number;
  shots: number;
  keyPasses: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  bonus: number;
  fantasyPoints: number;
}