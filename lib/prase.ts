export type LevelEntry = {
  levelId: string;
  levelAuthor: string;
  levelRating: number | null;
  levelDifficulty: string;     // can be empty ("")
  levelDownloads: number | null;
  levelTopTimesRaw?: string;   // keep raw for now
};

export type LevelListResult = {
  levels: LevelEntry[];
  hasMoreLevels: boolean;
};

function safeBase64Decode(s: string): string {
  try {
    // Some fields like levelId/author are base64 in backend examples.
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return s;
  }
}

export function parseLevelList(raw: string): LevelListResult {
  // The response can start with a fragment before the first "\levelId="
  const parts = raw.split("\\levelId=");
  const levels: LevelEntry[] = [];
  let hasMoreLevels = false;

  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (!chunk) continue;

    // Reattach 'levelId=' for uniform parsing (except maybe the first fragment)
    const block = (i === 0 && chunk.startsWith("levelId=")) ? chunk : `levelId=${chunk}`;

    const fields: Record<string, string> = {};
    // fields look like key=value pairs joined by &
    for (const segment of block.split("&")) {
      const [k, ...rest] = segment.split("=");
      if (!k) continue;
      const v = rest.join("="); // in case value contains '='
      // capture "hasMoreLevels=1" which might not fit key=value pairs list
      if (k === "hasMoreLevels" && v === "1") {
        hasMoreLevels = true;
      } else {
        fields[k] = v ?? "";
      }
    }

    // Pull interesting fields. Note difficulty can be truly empty string.
    const levelIdEncoded = (fields["levelId"] ?? "").trim();
    const levelAuthorEncoded = (fields["levelAuthor"] ?? "").trim();

    // Numeric helpers
    const num = (s?: string) => {
      if (!s?.trim()) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const entry: LevelEntry = {
      levelId: safeBase64Decode(levelIdEncoded || ""),       // many ids are base64
      levelAuthor: safeBase64Decode(levelAuthorEncoded || ""),
      levelRating: num(fields["levelRating"]),
      levelDifficulty: fields["levelDifficulty"] ?? "",      // may be ""
      levelDownloads: num(fields["levelDownloads"]),
      levelTopTimesRaw: fields["levelTopTimes"],
    };

    // Filter obvious empties
    if (entry.levelId) {
      levels.push(entry);
    }
  }

  return { levels, hasMoreLevels };
}
