import React, { useCallback, useEffect, useMemo, useState } from "react";

// ---- Small fetch helper (points to your backend) ---------------------------
const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001").replace(/\/+$/, "");

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

// ---- Types -----------------------------------------------------------------
export type SortBy = "ratings" | "downloads" | "recent";
export type Difficulty = "" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";

interface AuthState { uniqueId: number; token: string; ok: boolean }

interface LevelRow {
  levelId: string;           // base64 id from server (decoded for UI below)
  levelAuthor: string;       // base64 author (decoded for UI below)
  levelRating: number;       // e.g. 4.4
  levelDifficulty: string;   // e.g. "B"
  levelDownloads: number;    // e.g. 1287
}

interface LevelListResponse {
  levels: LevelRow[];
  hasMoreLevels: boolean;
}

interface HofEntry { player: string; time: string; map: string }

// ---- UI primitives ---------------------------------------------------------
function Card(props: { title?: string; right?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  const { title, right, className, children } = props;
  return (
    <div className={`card ${className ?? ""}`}>
      {(title || right) && (
        <div className="cardHead">
          {title && <h2>{title}</h2>}
          <div className="spacer" />
          {right}
        </div>
      )}
      {children}
      <style jsx>{`
        .card { background:#0e1014; border:1px solid #1e2330; border-radius:14px; padding:16px; box-shadow:0 8px 22px rgba(0,0,0,.35);}
        .cardHead{ display:flex; align-items:center; margin-bottom:12px;}
        h2{ font-size:16px; font-weight:600; margin:0; color:#e6ebff; letter-spacing:.3px;}
        .spacer{ flex:1 }
      `}</style>
    </div>
  );
}

function Row(props:{label:string; children?:React.ReactNode}){
  return (
    <label className="row">
      <span>{props.label}</span>
      {props.children}
      <style jsx>{`
        .row{ display:grid; grid-template-columns:160px 1fr; align-items:center; gap:12px; margin:10px 0; }
        .row>span{ color:#9fb0ff; font-size:13px; }
        input, select { background:#0a0c10; color:#e6ebff; border:1px solid #2a3246; border-radius:10px; padding:10px 12px; outline:none; }
        input:focus, select:focus{ border-color:#5580ff; box-shadow:0 0 0 3px rgba(85,128,255,.2);}
        button { background:#1b2748; color:#e6ebff; border:1px solid #2a3a6a; border-radius:10px; padding:10px 14px; cursor:pointer; font-weight:600; letter-spacing:.2px;}
        button:hover{ background:#21305a; }
        button:disabled{ opacity:.5; cursor:not-allowed; }
      `}</style>
    </label>
  );
}

function Tabs(props:{tabs:{key:string; label:string; badge?:string}[]; value:string; onChange:(k:string)=>void}){
  const { tabs, value, onChange } = props;
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.key} className={`tab ${t.key===value?"active":""}`} onClick={()=>onChange(t.key)}>
          <span>{t.label}</span>{t.badge && <em>{t.badge}</em>}
        </button>
      ))}
      <style jsx>{`
        .tabs{ display:flex; gap:8px; flex-wrap:wrap; }
        .tab{ background:#0e1322; border:1px solid #233158; color:#cbd7ff; padding:10px 14px; border-radius:999px; font-weight:600; }
        .tab.active{ background:#2a3f7a; border-color:#3d5eea; color:white; }
        .tab em{ margin-left:8px; background:#1f2b4e; border:1px solid #2f417a; padding:2px 8px; border-radius:999px; font-style:normal; font-size:12px;}
      `}</style>
    </div>
  );
}

// ---- Page ------------------------------------------------------------------
export default function HomePage() {
  // tabs
  const [tab, setTab] = useState<string>("browser");

  // auth
  const [uniqueId, setUniqueId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const authed = !!auth?.ok;

  // browser
  const [sortBy, setSortBy] = useState<SortBy>("ratings");
  const [page, setPage] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<Difficulty>(""); // blank default
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // HOF
  const [hof, setHof] = useState<HofEntry[]>([]);

  const decodeBase64 = useCallback((b64: string): string => {
    try { return Buffer.from(b64, "base64").toString("utf8"); } catch { return b64; }
  }, []);

  const doAuth = useCallback(async () => {
    try {
      setLoading(true);
      const uid = Number(uniqueId);
      const resp = await postJSON<{ ok:boolean }>("/authenticate", { uniqueId: uid, token: token.trim() });
      setAuth({ uniqueId: uid, token: token.trim(), ok: resp.ok });
      alert("Authenticated!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Auth error: ${msg}`);
    } finally { setLoading(false); }
  }, [uniqueId, token]);

  const fetchLevels = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await postJSON<LevelListResponse>("/requestLevelList", {
        uniqueId: auth?.uniqueId ?? 0,
        token: auth?.token ?? "",
        sortBy,
        page,
        withThumbnails: false,
        difficulty,
        searchFilter: filter,
      });
      setLevels(resp.levels);
      setHasMore(!!resp.hasMoreLevels);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Fetch error: ${msg}`);
    } finally { setLoading(false); }
  }, [auth, sortBy, page, difficulty, filter]);

  const fetchHof = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await postJSON<{ entries:HofEntry[] }>("/hof", { page: 1 });
      setHof(resp.entries);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`HOF error: ${msg}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === "hof" && hof.length === 0) void fetchHof(); }, [tab, hof.length, fetchHof]);

  return (
    <main>
      <header>
        <h1>NeoDash Toolkit</h1>
        <div className="grow" />
        <span className="badge">Backend: {API_BASE}</span>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "browser", label: "Level Browser" },
          { key: "hof", label: "Hall of Fame" },
          { key: "submit", label: "Submit Level", badge: "WIP" },
        ]}
      />

      {/* AUTH */}
      <Card title="Auth" right={<span className={`pill ${authed?"ok":"warn"}`}>{authed?"Authenticated":"Not authenticated"}</span>}>
        <Row label="Unique ID">
          <input inputMode="numeric" placeholder="e.g. 15206" value={uniqueId} onChange={e=>setUniqueId(e.target.value)} />
        </Row>
        <Row label="Token">
          <input placeholder="token" value={token} onChange={e=>setToken(e.target.value)} />
        </Row>
        <div className="actions">
          <button onClick={doAuth} disabled={loading || !uniqueId || !token}>Authenticate</button>
        </div>
      </Card>

      {/* TABS CONTENT */}
      {tab === "browser" && (
        <Card title="Search Levels">
          <div className="grid2">
            <Row label="Sort by">
              <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortBy)}>
                <option value="recent">recent</option>
                <option value="downloads">downloads</option>
                <option value="ratings">ratings</option>
              </select>
            </Row>
            <Row label="Page">
              <input inputMode="numeric" value={String(page)} onChange={e=>setPage(Number(e.target.value)||1)} />
            </Row>
            <Row label="Difficulty (optional)">
              <select value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>
                <option value="">(leave blank)</option>
                {(["D","C","B","A","S","SS","SSS"] as Difficulty[]).map(d=> (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Row>
            <Row label="Search">
              <input placeholder="filter text" value={filter} onChange={e=>setFilter(e.target.value)} />
            </Row>
          </div>
          <div className="actions">
            <button onClick={fetchLevels} disabled={loading}>Fetch</button>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:"28%"}}>Level</th>
                  <th style={{width:"24%"}}>Author</th>
                  <th style={{width:"12%"}}>Rating</th>
                  <th style={{width:"12%"}}>Difficulty</th>
                  <th style={{width:"12%"}}>Downloads</th>
                </tr>
              </thead>
              <tbody>
                {levels.length === 0 && (
                  <tr><td colSpan={5} className="empty">No results</td></tr>
                )}
                {levels.map((lv, i) => (
                  <tr key={`${lv.levelId}-${i}`}>
                    <td>{decodeBase64(lv.levelId)}</td>
                    <td>{decodeBase64(lv.levelAuthor)}</td>
                    <td>{lv.levelRating.toFixed(1)}</td>
                    <td>{lv.levelDifficulty}</td>
                    <td>{lv.levelDownloads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>◀ Prev</button>
            <span>Page {page}</span>
            <button onClick={()=>setPage(p=>p+1)} disabled={!hasMore}>Next ▶</button>
          </div>
        </Card>
      )}

      {tab === "hof" && (
        <Card title="Hall of Fame">
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Map</th>
                  <th style={{width:120}}>Time</th>
                </tr>
              </thead>
              <tbody>
                {hof.length===0 && <tr><td colSpan={3} className="empty">No entries yet</td></tr>}
                {hof.map((e,idx)=> (
                  <tr key={idx}>
                    <td>{e.player}</td>
                    <td>{e.map}</td>
                    <td>{e.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "submit" && (
        <Card title="Submit Level" right={<span className="pill warn">WORK IN PROGRESS</span>}>
          <p className="muted">This tab is intentionally disabled for now.</p>
        </Card>
      )}

      <footer>
        <span>NeoDash Toolkit · Dark UI</span>
      </footer>

      <style jsx global>{`
        :root{ --bg:#0a0c11; --text:#dbe7ff; --muted:#9fb0ff; }
        html,body,#__next{ height:100%; }
        body{ margin:0; background:radial-gradient(1200px 600px at 20% -10%, rgba(61,94,234,.15), transparent), #0a0c11; color:var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; }
        *{ box-sizing:border-box; }
        table{ width:100%; border-collapse:separate; border-spacing:0 8px; }
        thead th{ text-align:left; font-size:12px; color:#8aa0ff; font-weight:700; padding:0 10px; }
        tbody tr{ background:#0d1017; border:1px solid #1d2436; }
        tbody td{ padding:12px 10px; }
        tbody tr:hover{ border-color:#2d3e74; }
        .empty{ color:#6a78a8; text-align:center; padding:24px; }
        .tableWrap{ margin-top:14px; }
        .pager{ display:flex; gap:12px; align-items:center; justify-content:flex-end; margin-top:12px; }
        .pill{ padding:6px 10px; border-radius:999px; font-size:12px; border:1px solid #2a3a6a; background:#112042;}
        .pill.ok{ color:#90fbbd; border-color:#206a45; background:#0f2a22; }
        .pill.warn{ color:#ffeaa6; border-color:#5e4a13; background:#2a210a; }
        .muted{ color:#8aa0ff; opacity:.8; }
      `}</style>
      <style jsx>{`
        main{ max-width:1100px; margin:40px auto; padding:0 20px; display:flex; flex-direction:column; gap:18px; }
        header{ display:flex; align-items:center; gap:14px; }
        header h1{ margin:0; font-size:22px; letter-spacing:.4px; }
        header .badge{ font-size:12px; color:#9fb0ff; border:1px dashed #2a3a6a; padding:6px 10px; border-radius:10px; }
        .grow{ flex:1 }
        .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
        .actions{ display:flex; gap:10px; }
        footer{ opacity:.6; font-size:12px; padding:14px 4px; text-align:center; }
        @media (max-width: 880px){ .grid2{ grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}