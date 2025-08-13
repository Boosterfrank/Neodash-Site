import { useCallback, useMemo, useState } from "react";
import LevelSearchForm from "../components/LevelSearchForm";
import LevelTable from "../components/LevelTable";
import { postForm } from "../lib/api";
import { parseLevelList, LevelEntry } from "../lib/prase";

type AuthState = {
  uniqueId: string;
  token: string;
};
export default function Home() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<LevelEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const canFetch = !!auth?.uniqueId && !!auth?.token;

  const doAuth = useCallback(async () => {
    setLoading(true);
    try {
      // NOTE: the backend expects the same AUTH data the game sends.
      // Update these to match your flow if needed.
      const resp = await postForm<string>("/authenticate", {
        steamId: "YWxAB3ZedGgGb3sEYXVlB2k", // sample provided by you
        displayName: "Qm9vc3RlcmZyYW5r",
        ver: "102a",
      });

      // Parse key=value pairs
      const dict = Object.fromEntries(resp.trim().split("&").map(p => p.split("=")));
      const uniqueId = dict["uniqueId"] || "";
      const token = dict["token"] || "";

      if (!uniqueId || !token) {
        alert("Failed to parse uniqueId/token");
        return;
      }
      setAuth({ uniqueId, token });
      alert(`Authenticated. uniqueId=${uniqueId}`);
    } catch (e: any) {
      alert(`Auth error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchList = useCallback(async (opts: {
    sortBy: string;
    page: number;
    difficulty: string;
    searchFilter: string;
    withThumbnails: "TRUE" | "FALSE";
  }) => {
    if (!auth) {
      alert("Authenticate first.");
      return;
    }
    setLoading(true);
    try {
      const resp = await postForm<string>("/requestLevelList", {
        uniqueId: auth.uniqueId,
        token: auth.token,
        sortBy: opts.sortBy,
        page: String(opts.page),
        withThumbnails: opts.withThumbnails, // "FALSE" by default
        difficulty: opts.difficulty ?? "",   // exactly empty if blank
        searchFilter: opts.searchFilter ?? "",
      });

      const parsed = parseLevelList(resp);
      setLevels(parsed.levels);
      setHasMore(parsed.hasMoreLevels);
      setPage(opts.page);
    } catch (e: any) {
      alert(`List error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const onPageChange = useCallback((next: number) => {
    // Reuse the last search (store in state if you want full persistence).
    // For simplicity we refetch with defaults here:
    fetchList({
      sortBy: "ratings",
      page: next,
      difficulty: "",
      searchFilter: "",
      withThumbnails: "FALSE",
    });
  }, [fetchList]);

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Level Browser</h1>

      <section style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Auth</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={doAuth} disabled={loading}>Authenticate</button>
          <div>
            {auth ? (
              <small>
                uniqueId: <b>{auth.uniqueId}</b> &nbsp; token: <b>{auth.token}</b>
              </small>
            ) : <small>Not authenticated</small>}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Search Levels</h2>
        <LevelSearchForm
          disabled={loading || !canFetch}
          onSearch={(p) => fetchList(p)}
        />
      </section>

      <section style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Results</h2>
        <LevelTable
          levels={levels}
          hasMoreLevels={hasMore}
          page={page}
          onPageChange={onPageChange}
        />
      </section>

      <section style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fffbe6" }}>
        <h2>Submit Level (WORK IN PROGRESS)</h2>
        <p>Coming soon. This tab is intentionally disabled for now.</p>
      </section>

      {loading && <div>Loading…</div>}
    </main>
  );
}