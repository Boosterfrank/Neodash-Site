import React, { useCallback, useEffect, useState } from 'react';

type TabKey = 'hof' | 'levels' | 'submit';

type SortBy = 'ratings' | 'newest' | 'downloads' | 'difficulty';
type Difficulty = '' | 'A' | 'B' | 'C' | 'D' | 'E'; // '' = no filter

type AuthResponse = { uniqueId: string; token: string };
type HofRow = { rank: string; player: string; score: number };

export interface LevelSummary {
  levelId: string;           // decoded
  levelAuthor: string;       // decoded
  levelName: string;         // decoded
  levelRating: number;
  levelDifficulty: Difficulty | string;
  levelDownloads: number;
}

export interface LevelListResponse {
  levels: LevelSummary[];
  hasMoreLevels: boolean;
  page: number;
}

// --- helpers -------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

function b64decodeSafe(s: string): string {
  try {
    // The server uses plain base64 (not urlsafe) for names/ids.
    return typeof window === 'undefined'
      ? Buffer.from(s, 'base64').toString('utf-8')
      : atob(s);
  } catch {
    return s;
  }
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Parse raw HoF payload like: "QmFzZTY0TmFtZQ==,1234/...,5678/..." (game format)
function parseHofRaw(raw: string): HofRow[] {
  const out: { name: string; score: number }[] = [];
  const parts = raw.trim().split(',');
  if (parts.length < 2) return [];

  try {
    const firstName = b64decodeSafe(parts[0]);
    const [firstScoreRaw] = parts[1].split('/');
    const firstScore = parseInt(firstScoreRaw, 10);
    if (!Number.isNaN(firstScore) && firstName.trim()) {
      out.push({ name: firstName, score: firstScore });
    }
  } catch {
    // ignore and try continuing
  }

  for (const p of parts.slice(2)) {
    if (!p.includes('/')) continue;
    const [scoreRaw, encName] = p.split('/');
    const n = b64decodeSafe(encName ?? '');
    const s = parseInt(scoreRaw, 10);
    if (!Number.isNaN(s) && n.trim()) out.push({ name: n, score: s });
  }

  // sort desc score, stable
  out.sort((a, b) => b.score - a.score);

  // tie-aware ranks
  const rows: HofRow[] = [];
  let lastScore: number | null = null;
  let displayRank = 0;
  let place = 0;
  for (const row of out) {
    place += 1;
    if (lastScore === null || row.score !== lastScore) {
      displayRank = place;
      lastScore = row.score;
    }
    rows.push({ rank: ordinal(displayRank), player: row.name, score: row.score });
  }
  return rows;
}

// --- UI atoms ------------------------------------------------------------

type CardProps = {
  title: string;
  right?: React.ReactNode;
  className?: string;
  children?: React.ReactNode; // ✅ include children
};

const Card: React.FC<CardProps> = ({ title, right, className, children }) => (
  <div className={`rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-xl ${className ?? ''}`}>
    <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
      <h3 className="text-neutral-200 font-semibold">{title}</h3>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    {...props}
    className={`px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition ${className ?? ''}`}
  >
    {children}
  </button>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    {...props}
    className={`w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 ${className ?? ''}`}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select
    {...props}
    className={`w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 ${className ?? ''}`}
  >
    {children}
  </select>
);

// --- main page -----------------------------------------------------------

const IndexPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('hof');

  // shared auth
  const [uniqueId, setUniqueId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // HOF
  const [hofRows, setHofRows] = useState<HofRow[]>([]);
  const [hofBusy, setHofBusy] = useState<boolean>(false);
  const [hofError, setHofError] = useState<string>('');

  // Levels
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [levelsBusy, setLevelsBusy] = useState<boolean>(false);
  const [levelsError, setLevelsError] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortBy>('ratings');
  const [difficulty, setDifficulty] = useState<Difficulty>(''); // "" by default (no '+')
  const [searchFilter, setSearchFilter] = useState<string>('');

  const authenticate = useCallback(async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuthResponse = await res.json();
      setUniqueId(data.uniqueId);
      setToken(data.token);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Auth failed';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const fetchHof = useCallback(async () => {
    if (!uniqueId || !token) {
      setHofError('Please authenticate first.');
      return;
    }
    setHofBusy(true);
    setHofError('');
    try {
      const res = await fetch(`${API_BASE}/hof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId, token })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text(); // backend may proxy raw text
      const rows = parseHofRaw(text);
      setHofRows(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch Hall of Fame';
      setHofError(msg);
    } finally {
      setHofBusy(false);
    }
  }, [uniqueId, token]);

  const fetchLevels = useCallback(async () => {
    if (!uniqueId || !token) {
      setLevelsError('Please authenticate first.');
      return;
    }
    setLevelsBusy(true);
    setLevelsError('');
    try {
      const res = await fetch(`${API_BASE}/levels/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uniqueId,
          token,
          sortBy,
          page,
          withThumbnails: false,
          difficulty,      // NOTE: when "", we send empty (no '+')
          searchFilter
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Prefer JSON response. If your backend still returns raw, adapt here.
      const data: LevelListResponse = await res.json();
      setLevels(data.levels ?? []);
      setHasMore(Boolean(data.hasMoreLevels));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch levels';
      setLevelsError(msg);
    } finally {
      setLevelsBusy(false);
    }
  }, [uniqueId, token, sortBy, page, difficulty, searchFilter]);

  // refetch levels on filters/page change when on levels tab
  useEffect(() => {
    if (tab === 'levels' && uniqueId && token) {
      void fetchLevels();
    }
  }, [tab, uniqueId, token, sortBy, page, difficulty, searchFilter, fetchLevels]);

  // --- renderers ---------------------------------------------------------

  const Tabs = (
    <div className="flex gap-2">
      {([
        { k: 'hof', label: 'Hall of Fame' },
        { k: 'levels', label: 'Level Browser' },
        { k: 'submit', label: 'Submit Level (WIP)' },
      ] as { k: TabKey; label: string }[]).map(({ k, label }) => (
        <button
          key={k}
          onClick={() => setTab(k)}
          className={`px-4 py-2 rounded-xl border transition
            ${tab === k
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-neutral-200">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Trackmania Helper</h1>
          {Tabs}
        </header>

        {/* AUTH CARD (persistent at top) */}
        <Card
          title="Game Authentication"
          right={
            <div className="flex items-center gap-2">
              <Button onClick={authenticate} disabled={authBusy}>
                {authBusy ? 'Authenticating…' : 'Authenticate'}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-neutral-400">Unique ID</label>
              <Input value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Token</label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="—" />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-neutral-400">
                Uses your backend proxy at <span className="text-neutral-300">{API_BASE || '(unset)'}</span>
              </div>
            </div>
          </div>
          {authError && <div className="mt-3 text-rose-400 text-sm">{authError}</div>}
        </Card>

        <div className="mt-6 space-y-6">
          {/* TAB: HOF */}
          {tab === 'hof' && (
            <Card
              title="Hall of Fame"
              right={<Button onClick={fetchHof} disabled={!uniqueId || !token || hofBusy}>
                {hofBusy ? 'Fetching…' : 'Fetch Hall of Fame'}
              </Button>}
            >
              {hofError && <div className="mb-3 text-rose-400 text-sm">{hofError}</div>}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-neutral-400 border-b border-neutral-800">
                      <th className="text-left py-2 pr-4">Rank</th>
                      <th className="text-left py-2 pr-4">Player</th>
                      <th className="text-left py-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hofRows.length === 0 && !hofBusy && (
                      <tr>
                        <td colSpan={3} className="py-8 text-neutral-500 text-center">No data yet. Click “Fetch Hall of Fame”.</td>
                      </tr>
                    )}
                    {hofRows.map((r) => (
                      <tr key={`${r.rank}-${r.player}`} className="border-b border-neutral-900 hover:bg-neutral-900/50">
                        <td className="py-2 pr-4 font-mono">{r.rank}</td>
                        <td className="py-2 pr-4">{r.player}</td>
                        <td className="py-2">{r.score.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB: LEVEL BROWSER */}
          {tab === 'levels' && (
            <Card title="Level Browser" right={null}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-neutral-400">Search</label>
                  <Input
                    placeholder="Search text…"
                    value={searchFilter}
                    onChange={(e) => { setPage(1); setSearchFilter(e.target.value); }}
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Sort by</label>
                  <Select
                    value={sortBy}
                    onChange={(e) => { setPage(1); setSortBy(e.target.value as SortBy); }}
                  >
                    <option value="ratings">Ratings</option>
                    <option value="newest">Newest</option>
                    <option value="downloads">Downloads</option>
                    <option value="difficulty">Difficulty</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Difficulty</label>
                  <Select
                    value={difficulty}
                    onChange={(e) => { setPage(1); setDifficulty(e.target.value as Difficulty); }}
                  >
                    <option value="">(Any)</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => { setPage(1); void fetchLevels(); }} disabled={levelsBusy || !uniqueId || !token}>
                    {levelsBusy ? 'Loading…' : 'Fetch Levels'}
                  </Button>
                </div>
              </div>

              {levelsError && <div className="mb-3 text-rose-400 text-sm">{levelsError}</div>}

              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-900/60 text-neutral-400">
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-left px-4 py-2">Author</th>
                      <th className="text-left px-4 py-2">Rating</th>
                      <th className="text-left px-4 py-2">Difficulty</th>
                      <th className="text-left px-4 py-2">Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.length === 0 && !levelsBusy && (
                      <tr>
                        <td colSpan={5} className="py-8 text-neutral-500 text-center">
                          No levels yet. Adjust filters and click “Fetch Levels”.
                        </td>
                      </tr>
                    )}
                    {levels.map((lvl) => (
                      <tr key={`${lvl.levelId}-${lvl.levelAuthor}`} className="border-t border-neutral-900 hover:bg-neutral-900/50">
                        <td className="px-4 py-2">{lvl.levelName}</td>
                        <td className="px-4 py-2">{lvl.levelAuthor}</td>
                        <td className="px-4 py-2">{Number.isFinite(lvl.levelRating) ? lvl.levelRating.toFixed(2) : '—'}</td>
                        <td className="px-4 py-2">{lvl.levelDifficulty || '—'}</td>
                        <td className="px-4 py-2">{Number.isFinite(lvl.levelDownloads) ? lvl.levelDownloads.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-neutral-400 text-sm">Page {page}{hasMore ? '' : ' (last page)'}</div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => { if (page > 1) setPage(page - 1); }}
                    disabled={page <= 1 || levelsBusy}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                  >
                    Prev
                  </Button>
                  <Button
                    onClick={() => { if (hasMore) setPage(page + 1); }}
                    disabled={!hasMore || levelsBusy}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB: SUBMIT LEVEL (WIP) */}
          {tab === 'submit' && (
            <Card
              title="Submit Level"
              right={<span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs border border-amber-700/40">WORK IN PROGRESS</span>}
            >
              <p className="text-neutral-400">
                This feature is under active development. For now, use the desktop tool to submit levels.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 pointer-events-none select-none">
                <div>
                  <label className="text-sm text-neutral-500">Level Name (base64-encoded by server)</label>
                  <Input placeholder="Auto-encoded on submit" disabled />
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Difficulty</label>
                  <Select disabled>
                    <option>Choose…</option>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-neutral-500">Level Data</label>
                  <textarea
                    className="w-full min-h-[160px] px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100"
                    placeholder="Paste levelData here…"
                    disabled
                  />
                </div>
                <div className="md:col-span-2">
                  <Button disabled>Submit (WIP)</Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-neutral-500">
          backend: <span className="text-neutral-300">{API_BASE || 'not set (NEXT_PUBLIC_API_BASE)'}</span>
        </footer>
      </div>
    </main>
  );
};

export default IndexPage;