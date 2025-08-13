import { LevelEntry } from "../lib/prase";

type Props = {
  levels: LevelEntry[];
  hasMoreLevels: boolean;
  page: number;
  onPageChange: (nextPage: number) => void;
};

export default function LevelTable({ levels, hasMoreLevels, page, onPageChange }: Props) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table border={1} cellPadding={6} cellSpacing={0} style={{ width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th>Level ID</th>
            <th>Author</th>
            <th>Rating</th>
            <th>Difficulty</th>
            <th>Downloads</th>
          </tr>
        </thead>
        <tbody>
          {levels.length === 0 ? (
            <tr><td colSpan={5}>No results</td></tr>
          ) : (
            levels.map((lv, idx) => (
              <tr key={`${lv.levelId}-${idx}`}>
                <td>{lv.levelId}</td>
                <td>{lv.levelAuthor}</td>
                <td>{lv.levelRating ?? ""}</td>
                <td>{lv.levelDifficulty}</td>
                <td>{lv.levelDownloads ?? ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          ◀ Prev
        </button>
        <div>Page {page}</div>
        <button onClick={() => onPageChange(page + 1)} disabled={!hasMoreLevels}>
          Next ▶
        </button>
      </div>
    </div>
  );
}