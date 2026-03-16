'use client';

import { useEffect, useMemo, useState } from 'react';

type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

type DashboardResponse = {
  dataSource?: 'seed' | 'fpl';
  syncStatus?: 'ok' | 'failed' | 'skipped';
  snapshot: {
    id: number;
    gameweek: number;
    budget: number;
    freeTransfers: number;
    players: Array<{ playerId: number; name: string; position: string; team: string }>;
  };
  captain: any;
  transferPlan: any;
  fixtureRun: any;
  weakness: any;
};

export default function HomePage() {
  const [snapshotId, setSnapshotId] = useState<number | undefined>(undefined);
  const [horizon, setHorizon] = useState<3 | 5>(3);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');
  const [useSimulation, setUseSimulation] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  const effectiveSnapshotId = snapshotId ?? dashboard?.snapshot.id;

  const dashboardQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('horizon', String(horizon));
    params.set('riskProfile', riskProfile);
    params.set('useSimulation', String(useSimulation));
    params.set('source', 'fpl');
    if (snapshotId) {
      params.set('snapshotId', String(snapshotId));
    }
    return params.toString();
  }, [horizon, riskProfile, useSimulation, snapshotId]);

  useEffect(() => {
    void loadDashboard();
  }, [dashboardQuery]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard?${dashboardQuery}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to load dashboard');
      }
      setDashboard(data);
      if (!snapshotId) {
        setSnapshotId(data.snapshot.id);
      }
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Dashboard load failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitChat() {
    const trimmed = message.trim();
    if (!trimmed || !effectiveSnapshotId) {
      return;
    }

    setChatHistory((prev) => [...prev, { role: 'user', text: trimmed }]);
    setMessage('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          snapshotId: effectiveSnapshotId,
          horizon,
          riskProfile,
          useSimulation,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? 'Copilot request failed');
      }

      setChatHistory((prev) => [...prev, { role: 'assistant', text: String(data.answer ?? '') }]);
      if (data.summaryCards) {
        void loadDashboard();
      }
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Copilot error: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-5 rounded-2xl border border-slate-900/10 bg-white/80 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fantasy AI Copilot</h1>
            <p className="text-sm text-slate-600">Deterministic engine + orchestrated AI explanation</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge">Snapshot {dashboard?.snapshot.id ?? '-'}</span>
            <span className="badge">GW {dashboard?.snapshot.gameweek ?? '-'}</span>
            <span className="badge">Budget {dashboard?.snapshot.budget ?? '-'}</span>
            <span className="badge">FT {dashboard?.snapshot.freeTransfers ?? '-'}</span>
            <span className="badge">Source {dashboard?.dataSource ?? '-'}</span>
            <span className="badge">Sync {dashboard?.syncStatus ?? '-'}</span>
          </div>
        </div>
      </header>

      <section className="mb-6 card p-4">
        <h2 className="mb-3 text-lg font-semibold">Controls</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            Snapshot ID
            <input
              className="rounded border border-slate-300 px-3 py-2"
              type="number"
              min={1}
              value={snapshotId ?? ''}
              onChange={(e) => setSnapshotId(e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Horizon
            <select
              className="rounded border border-slate-300 px-3 py-2"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value) as 3 | 5)}
            >
              <option value={3}>3 GW</option>
              <option value={5}>5 GW</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Risk Profile
            <select
              className="rounded border border-slate-300 px-3 py-2"
              value={riskProfile}
              onChange={(e) => setRiskProfile(e.target.value as RiskProfile)}
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={useSimulation}
              onChange={(e) => setUseSimulation(e.target.checked)}
            />
            Enable simulation
          </label>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={loadDashboard}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-4">
          <h3 className="mb-2 text-base font-semibold">Captain Recommendation</h3>
          <p className="text-sm text-slate-700">
            Balanced: <strong>{dashboard?.captain?.bestBalancedCaptain?.playerName ?? '-'}</strong>
          </p>
          <p className="text-sm text-slate-700">
            Safe: <strong>{dashboard?.captain?.bestSafeCaptain?.playerName ?? '-'}</strong>
          </p>
          <p className="text-sm text-slate-700">
            Upside: <strong>{dashboard?.captain?.bestUpsideCaptain?.playerName ?? '-'}</strong>
          </p>
        </article>

        <article className="card p-4">
          <h3 className="mb-2 text-base font-semibold">Transfer Plan</h3>
          <p className="text-sm text-slate-700">
            Total projected gain: <strong>{dashboard?.transferPlan?.totalProjectedGain ?? '-'}</strong>
          </p>
          <p className="text-sm text-slate-700">
            This week action: <strong>{dashboard?.transferPlan?.byGameweek?.[0]?.action ?? '-'}</strong>
          </p>
          <p className="text-sm text-slate-700">
            Transfers used: <strong>{dashboard?.transferPlan?.byGameweek?.[0]?.transfersUsed ?? '-'}</strong>
          </p>
        </article>

        <article className="card p-4">
          <h3 className="mb-2 text-base font-semibold">Fixture Run</h3>
          <p className="mb-1 text-sm text-slate-700">Easiest teams:</p>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {(dashboard?.fixtureRun?.easiestFixtureRuns ?? []).slice(0, 3).map((item: any) => (
              <li key={item.teamId}>{item.team}</li>
            ))}
          </ul>
        </article>

        <article className="card p-4">
          <h3 className="mb-2 text-base font-semibold">Squad Weaknesses</h3>
          <p className="mb-1 text-sm text-slate-700">Weak spots:</p>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {(dashboard?.weakness?.weakSpotsByExpectedPoints ?? []).slice(0, 3).map((item: any) => (
              <li key={item.playerId}>{item.playerName}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-6 card p-4">
        <h2 className="mb-3 text-lg font-semibold">Copilot Chat</h2>
        <div className="mb-3 max-h-80 space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-3">
          {chatHistory.length === 0 ? (
            <p className="text-sm text-slate-500">Ask about captaincy, transfers, fixture swings, or weaknesses.</p>
          ) : (
            chatHistory.map((entry, idx) => (
              <div key={idx} className={entry.role === 'user' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    entry.role === 'user' ? 'bg-slate-900 text-white' : 'bg-amber-100 text-slate-900'
                  }`}
                >
                  {entry.text}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Example: Should I roll this week or use my FT?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitChat();
              }
            }}
          />
          <button
            className="rounded bg-field px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
            onClick={submitChat}
            disabled={chatLoading || !effectiveSnapshotId}
          >
            {chatLoading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </section>
    </main>
  );
}
