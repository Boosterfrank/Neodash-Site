export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") || "http://localhost:3001";

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  if (!res.ok) {
    // surface backend error body to the UI
    throw new Error(`${res.status} ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // some endpoints might return raw text; adapt if needed
    return text as unknown as T;
  }
}

// Adjust these paths to match your **working backend** endpoints:
export const api = {
  authenticate: (payload: { uniqueId: number; token: string }) =>
    postJSON("/authenticate", payload),

  // level list (no thumbnails by default per your spec)
  searchLevels: (payload: {
    sortBy: "ratings" | "downloads" | "recent";
    page: number;
    difficulty?: "" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";
    searchFilter?: string;
    withThumbnails?: boolean; // default false
  }) => postJSON("/requestLevelList", payload),

  hallOfFame: (payload: { page: number }) => postJSON("/hof", payload),
};
