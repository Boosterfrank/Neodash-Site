export async function postForm<T = string>(
  endpoint: string,
  data: Record<string, string>
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const body = new URLSearchParams(data);

  const res = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upstream ${res.status}: ${text}`);
  }
  // Most endpoints return raw text; caller can parse.
  return text as unknown as T;
}
