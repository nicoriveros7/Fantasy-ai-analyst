import { NextRequest, NextResponse } from 'next/server';

const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const snapshotIdRaw = url.searchParams.get('snapshotId');
  const horizon = Number(url.searchParams.get('horizon') ?? 3) as 3 | 5;
  const riskProfile = url.searchParams.get('riskProfile') ?? 'balanced';
  const useSimulation = url.searchParams.get('useSimulation') === 'true';
  const requestedSource = (url.searchParams.get('source') ?? 'fpl').toLowerCase();

  let dataSource = requestedSource === 'seed' ? 'seed' : 'fpl';
  let syncStatus: 'ok' | 'failed' | 'skipped' = 'skipped';

  if (dataSource === 'fpl') {
    try {
      const syncResponse = await fetch(`${apiBaseUrl}/ingestion/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'fpl',
          includePlayerHistory: false,
          playerHistoryMode: 'top',
          playerHistoryLimit: 30,
        }),
      });

      syncStatus = syncResponse.ok ? 'ok' : 'failed';
      if (!syncResponse.ok) {
        dataSource = 'seed';
      }
    } catch {
      syncStatus = 'failed';
      dataSource = 'seed';
    }
  }

  const snapshotResponse = snapshotIdRaw
    ? await fetch(`${apiBaseUrl}/team/snapshots/${Number(snapshotIdRaw)}`)
    : await fetch(`${apiBaseUrl}/team/snapshots/latest`);

  if (!snapshotResponse.ok) {
    const text = await snapshotResponse.text();
    return NextResponse.json({ error: text || 'Snapshot fetch failed' }, { status: snapshotResponse.status });
  }

  const snapshot = await snapshotResponse.json();

  const [captain, transferPlan, fixtureRun, weakness] = await Promise.all([
    fetch(
      `${apiBaseUrl}/recommendations/captains/advanced?gameweek=${snapshot.gameweek}&limit=5&useSimulation=${useSimulation}&riskProfile=${riskProfile}`,
    ).then((res) => res.json()),
    fetch(`${apiBaseUrl}/team/plan-transfers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        snapshotId: snapshot.id,
        horizon,
        useSimulation,
        riskProfile,
      }),
    }).then((res) => res.json()),
    fetch(`${apiBaseUrl}/teams/fixture-run?next=${horizon}&startGameweek=${snapshot.gameweek}`).then((res) =>
      res.json(),
    ),
    fetch(`${apiBaseUrl}/team/analyze-weakness`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        snapshotId: snapshot.id,
        horizon,
        riskProfile,
      }),
    }).then((res) => res.json()),
  ]);

  return NextResponse.json({
    dataSource,
    syncStatus,
    snapshot,
    captain,
    transferPlan,
    fixtureRun,
    weakness,
  });
}
