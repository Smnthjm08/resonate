import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Board } from "@/components/game/board";
import { StatusBadge } from "@/components/game/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ApiError, getGame, type GameDetail, type Move } from "@/lib/api";

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Pairs the flat move list into numbered white/black rows. */
function toRows(moves: Move[]) {
  const rows: { number: number; white?: string; black?: string }[] = [];

  for (const move of moves) {
    const index = Math.floor((move.moveNumber - 1) / 2);
    const row = (rows[index] ??= { number: index + 1 });

    if (move.moveNumber % 2 === 1) row.white = move.san;
    else row.black = move.san;
  }

  return rows;
}

function PlayerRow({
  label,
  name,
  clock,
}: {
  label: string;
  name: string;
  clock: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium">{name}</p>
      </div>
      <span className="font-mono text-lg tabular-nums">
        {formatClock(clock)}
      </span>
    </div>
  );
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;

  let game: GameDetail;

  try {
    game = (await getGame(gameId)).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const rows = toRows(game.moves);

  return (
    <div className="min-h-svh">
      <SiteHeader />

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Board fen={game.fen} />

        <aside className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Players</CardTitle>
              <StatusBadge status={game.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <PlayerRow
                label="Black"
                name={game.black?.username ?? "Open seat"}
                clock={game.blackTimeMs}
              />
              <Separator />
              <PlayerRow
                label="White"
                name={game.white?.username ?? "Open seat"}
                clock={game.whiteTimeMs}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Moves</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No moves played yet.
                </p>
              ) : (
                <ScrollArea className="h-64">
                  <ol className="space-y-1 font-mono text-sm">
                    {rows.map((row) => (
                      <li key={row.number} className="flex gap-3">
                        <span className="text-muted-foreground w-6 text-right">
                          {row.number}.
                        </span>
                        <span className="w-16">{row.white}</span>
                        <span className="w-16">{row.black}</span>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
