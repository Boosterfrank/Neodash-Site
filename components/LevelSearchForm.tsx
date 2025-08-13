import { useState } from "react";

type Props = {
  onSearch: (params: {
    sortBy: string;
    page: number;
    difficulty: string;   // can be ""
    searchFilter: string;
    withThumbnails: "TRUE" | "FALSE";
  }) => void;
  disabled?: boolean;
};

export default function LevelSearchForm({ onSearch, disabled }: Props) {
  const [sortBy, setSortBy] = useState("ratings");
  const [page, setPage] = useState(1);
  const [difficulty, setDifficulty] = useState(""); // exactly empty by default
  const [searchFilter, setSearchFilter] = useState("");
  const [withThumbs, setWithThumbs] = useState<"TRUE" | "FALSE">("FALSE");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch({ sortBy, page, difficulty, searchFilter, withThumbnails: withThumbs });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label>
        Sort by
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} disabled={disabled}>
          <option value="ratings">ratings</option>
          <option value="downloads">downloads</option>
          <option value="date">date</option>
        </select>
      </label>

      <label>
        Page
        <input
          type="number"
          min={1}
          value={page}
          onChange={(e) => setPage(parseInt(e.target.value || "1", 10))}
          disabled={disabled}
        />
      </label>

      <label>
        Difficulty (optional)
        <input
          placeholder="leave blank"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          disabled={disabled}
        />
      </label>

      <label>
        Search
        <input
          placeholder="filter text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          disabled={disabled}
        />
      </label>

      <label>
        Thumbnails
        <select
          value={withThumbs}
          onChange={(e) => setWithThumbs(e.target.value as "TRUE" | "FALSE")}
          disabled={disabled}
        >
          <option value="FALSE">FALSE</option>
          <option value="TRUE">TRUE</option>
        </select>
      </label>

      <button type="submit" disabled={disabled}>Fetch</button>
    </form>
  );
}