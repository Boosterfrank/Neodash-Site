import React, { useMemo, useState } from "react";

// Reusable UI primitives (keeps the look consistent everywhere)
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const Card: React.FC<React.PropsWithChildren<{ title?: string; right?: React.ReactNode; className?: string }>> = ({ title, right, className, children }) => (
  <div className={cx(
    "rounded-2xl bg-[#0c1220]/80 backdrop-blur border border-white/10 shadow-xl",
    "p-5 sm:p-6", className
  )}>
    {(title || right) && (
      <div className="mb-4 flex items-center gap-2">
        {title && <h2 className="text-lg font-semibold text-white/90 tracking-wide">{title}</h2>}
        <div className="ml-auto text-sm text-white/60">{right}</div>
      </div>
    )}
    {children}
  </div>
);

const Label: React.FC<React.PropsWithChildren<{ htmlFor?: string }>> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-[13px] font-medium text-white/70 mb-1.5">
    {children}
  </label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        "w-full h-9 rounded-lg px-3 text-[13px] text-white/90",
        "bg-white/5 border border-white/10 outline-none",
        "focus:(border-sky-400/60 ring-2 ring-sky-400/20)",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select
    className={cx(
      "w-full h-9 rounded-lg px-3 text-[13px] text-white/90",
      "bg-white/5 border border-white/10 outline-none appearance-none",
      "focus:(border-sky-400/60 ring-2 ring-sky-400/20)",
      className
    )}
    {...props}
  >
    {children}
  </select>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }>
= ({ className, variant = "primary", children, ...props }) => (
  <button
    className={cx(
      "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-[13px]",
      variant === "primary"
        ? "bg-sky-500/90 text-white hover:bg-sky-400 active:bg-sky-500"
        : "bg-white/5 text-white/80 hover:bg-white/10",
      "border border-white/10 shadow hover:shadow-sky-500/10 transition",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

const Pill: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">{children}</span>
);

/* ----------------------- Page ----------------------- */

type SortBy = "ratings" | "downloads" | "recent";

type TabKey = "browser" | "hof" | "submit";

export default function NeoDashToolkit() {
  const [active, setActive] = useState<TabKey>("browser");

  // Auth
  const [uniqueId, setUniqueId] = useState("15206");
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);

  // Search
  const [sortBy, setSortBy] = useState<SortBy>("ratings");
  const [page, setPage] = useState(1);
  const [difficulty, setDifficulty] = useState(""); // blank by default
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const difficultyOptions = ["", "D", "C", "B", "A", "S", "SS", "SSS"];

  const doAuth = async () => {
    try {
      const r = await fetch(`${backendUrl}/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueId, token })
      });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      setAuthed(true);
    } catch (e) {
      alert(`Auth error: ${e}`);
      setAuthed(false);
    }
  };

  const fetchList = async () => {
    setLoading(true);
    setRows([]);
    try {
      const params = new URLSearchParams({
        sortBy,
        page: String(page),
        withThumbnails: "FALSE",
        difficulty, // blank means no filter
        searchFilter: search
      });
      const r = await fetch(`${backendUrl}/requestLevelList?${params.toString()}`);
      const data = await r.json();
      setRows(data.levels || []);
    } catch (e) {
      alert(`Fetch error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const TabButton: React.FC<{ k: TabKey; label: string; badge?: string }>
    = ({ k, label, badge }) => (
    <button
      onClick={() => setActive(k)}
      className={cx(
        "h-9 px-3 rounded-xl text-sm border",
        active === k
          ? "bg-white/10 text-white border-white/20"
          : "text-white/70 border-white/10 hover:bg-white/5"
      )}
    >
      <span>{label}</span>
      {badge && <span className="ml-2 text-[11px] opacity-70">{badge}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-white/90">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">NeoDash Toolkit</h1>
          <div className="ml-auto">
            <Pill>Backend: {backendUrl}</Pill>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <TabButton k="browser" label="Level Browser" />
          <TabButton k="hof" label="Hall of Fame" />
          <TabButton k="submit" label="Submit Level" badge="WIP" />
        </div>

        {active === "browser" && (
          <div className="space-y-6">
            <Card title="Auth" right={<Pill>{authed ? "Authenticated" : "Not authenticated"}</Pill>}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="uid">Unique ID</Label>
                  <Input id="uid" placeholder="e.g. 15206" value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tok">Token</Label>
                  <Input id="tok" placeholder="token" value={token} onChange={(e) => setToken(e.target.value)} />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={doAuth}>Authenticate</Button>
              </div>
            </Card>

            <Card title="Search Levels">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Sort by</Label>
                  <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                    <option value="ratings">ratings</option>
                    <option value="downloads">downloads</option>
                    <option value="recent">recent</option>
                  </Select>
                </div>
                <div>
                  <Label>Page</Label>
                  <Input type="number" min={1} value={page} onChange={(e) => setPage(parseInt(e.target.value || "1", 10))} />
                </div>
                <div>
                  <Label>Difficulty (optional)</Label>
                  <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    {difficultyOptions.map((d) => (
                      <option key={d || "blank"} value={d}>{d ? d : "(leave blank)"}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Search</Label>
                  <Input placeholder="filter text" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={fetchList}>Fetch</Button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white/60">
                    <tr className="border-b border-white/10">
                      <th className="py-2 pr-4">Level</th>
                      <th className="py-2 pr-4">Author</th>
                      <th className="py-2 pr-4">Rating</th>
                      <th className="py-2 pr-4">Difficulty</th>
                      <th className="py-2 pr-4">Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td className="py-6 text-center text-white/50" colSpan={5}>Loading…</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td className="py-6 text-center text-white/50" colSpan={5}>No results</td></tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 pr-4">{r.levelName ?? r.levelId ?? "—"}</td>
                          <td className="py-2 pr-4">{r.levelAuthor ?? "—"}</td>
                          <td className="py-2 pr-4">{r.levelRating ?? "—"}</td>
                          <td className="py-2 pr-4">{r.levelDifficulty ?? "—"}</td>
                          <td className="py-2 pr-4">{r.levelDownloads ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))}>&lt; Prev</Button>
                <span className="text-white/70 text-sm">Page {page}</span>
                <Button variant="ghost" onClick={() => setPage((p) => p + 1)}>Next &gt;</Button>
              </div>
            </Card>
          </div>
        )}

        {active === "hof" && (
          <Card title="Hall of Fame">
            <p className="text-white/70 text-sm">Coming soon.</p>
          </Card>
        )}

        {active === "submit" && (
          <Card title="Submit Level" right={<Pill>WORK IN PROGRESS</Pill>}>
            <p className="text-white/70 text-sm">This feature is intentionally disabled for now.</p>
          </Card>
        )}

        <footer className="mt-10 text-center text-xs text-white/50">NeoDash Toolkit · Dark UI</footer>
      </div>
    </div>
  );
}
