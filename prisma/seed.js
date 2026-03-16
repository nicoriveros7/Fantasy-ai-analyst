const { readFile } = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5437';
  const db = process.env.POSTGRES_DB || 'fantasy_ai';

  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
});

async function loadSeedData() {
  const filePath = path.resolve(process.cwd(), 'prisma', 'seed-data.json');
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function resetData() {
  await prisma.message.deleteMany();
  await prisma.matchStat.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.playerMetric.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.player.deleteMany();
  await prisma.gameweek.deleteMany();
  await prisma.team.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.ingestionRun.deleteMany();
}

async function main() {
  const data = await loadSeedData();

  await resetData();

  const teamByExternalId = new Map();
  const playerByExternalId = new Map();
  const gameweekByExternalId = new Map();
  const fixtureByExternalId = new Map();

  for (const team of data.teams) {
    const created = await prisma.team.create({
      data: {
        externalId: team.externalId,
        name: team.name,
        shortName: team.shortName,
        strengthAttack: team.strengthAttack,
        strengthDefense: team.strengthDefense,
      },
    });
    teamByExternalId.set(team.externalId, created);
  }

  for (const gameweek of data.gameweeks) {
    const created = await prisma.gameweek.create({
      data: {
        externalId: gameweek.externalId,
        number: gameweek.number,
        deadlineAt: new Date(gameweek.deadlineAt),
        isCurrent: gameweek.isCurrent,
        isFinished: gameweek.isFinished,
      },
    });
    gameweekByExternalId.set(gameweek.externalId, created);
  }

  for (const fixture of data.fixtures) {
    const created = await prisma.fixture.create({
      data: {
        externalId: fixture.externalId,
        gameweekId: gameweekByExternalId.get(fixture.gameweekExternalId).id,
        homeTeamId: teamByExternalId.get(fixture.homeTeamExternalId).id,
        awayTeamId: teamByExternalId.get(fixture.awayTeamExternalId).id,
        kickoffAt: new Date(fixture.kickoffAt),
        homeDifficulty: fixture.homeDifficulty,
        awayDifficulty: fixture.awayDifficulty,
        isFinished: fixture.isFinished,
      },
    });
    fixtureByExternalId.set(fixture.externalId, created);
  }

  for (const player of data.players) {
    const created = await prisma.player.create({
      data: {
        externalId: player.externalId,
        teamId: teamByExternalId.get(player.teamExternalId).id,
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
    });
    playerByExternalId.set(player.externalId, created);
  }

  for (const stat of data.matchStats) {
    await prisma.matchStat.create({
      data: {
        playerId: playerByExternalId.get(stat.playerExternalId).id,
        fixtureId: fixtureByExternalId.get(stat.fixtureExternalId).id,
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
  }

  console.log('Seed completed:', {
    teams: data.teams.length,
    players: data.players.length,
    fixtures: data.fixtures.length,
    matchStats: data.matchStats.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });