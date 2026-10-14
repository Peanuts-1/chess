import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fetches a player's recent standard games from chess.com's public API.
export async function GET(req: NextRequest) {
  const user = (req.nextUrl.searchParams.get("user") || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(user))
    return NextResponse.json({ error: "Enter a valid chess.com username." }, { status: 400 });

  const headers = { "User-Agent": "Openfile chess review (personal project)" };
  try {
    const arc = await fetch(`https://api.chess.com/pub/player/${user}/games/archives`, { headers, cache: "no-store" });
    if (arc.status === 404) return NextResponse.json({ error: "No chess.com player with that username." }, { status: 404 });
    if (!arc.ok) return NextResponse.json({ error: "chess.com did not respond. Try again in a moment." }, { status: 502 });
    const { archives = [] } = (await arc.json()) as { archives?: string[] };

    const games: Record<string, unknown>[] = [];
    for (const url of archives.slice(-3).reverse()) {
      const r = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) continue;
      const j = (await r.json()) as { games?: any[] };
      for (const g of [...(j.games ?? [])].reverse()) {
        if (!g.pgn || g.rules !== "chess") continue;
        games.push({
          url: g.url, white: g.white?.username, black: g.black?.username,
          whiteResult: g.white?.result, blackResult: g.black?.result,
          timeClass: g.time_class, endTime: g.end_time, pgn: g.pgn,
        });
        if (games.length >= 25) break;
      }
      if (games.length >= 25) break;
    }
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ error: "Could not reach chess.com." }, { status: 502 });
  }
}
