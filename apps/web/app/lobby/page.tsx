import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CreateGameButton } from "@/components/game/create-game-button";
import { StatusBadge } from "@/components/game/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { listGames, type Game } from "@/lib/api";

function playerName(player: Game["white"], fallback: string) {
  return player?.username ?? (player ? "Guest" : fallback);
}

async function loadGames() {
  try {
    const { data } = await listGames({ limit: 20 });
    return { games: data, error: null as string | null };
  } catch (error) {
    return {
      games: [] as Game[],
      error: error instanceof Error ? error.message : "Could not reach the server",
    };
  }
}

export default async function LobbyPage() {
  const { games, error } = await loadGames();

  return (
    <div className="min-h-svh">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Lobby</h1>
            <p className="text-muted-foreground text-sm">
              Open a new board or join a game that is waiting for an opponent.
            </p>
          </div>

          <CreateGameButton />
        </div>

        {error ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Server unreachable</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : games.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No games yet</EmptyTitle>
              <EmptyDescription>
                Create the first one and share the link with an opponent.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {games.map((game) => (
              <li key={game.id}>
                <Link href={`/game/${game.id}`} className="block">
                  <Card className="hover:border-hairline-strong transition-colors">
                    <CardContent className="flex items-center gap-4">
                      <StatusBadge status={game.status} />

                      <span className="text-sm">
                        {playerName(game.white, "Open seat")}
                        <span className="text-muted-foreground px-2">vs</span>
                        {playerName(game.black, "Open seat")}
                      </span>

                      <code className="text-muted-foreground ml-auto font-mono text-xs">
                        {game.id.slice(0, 8)}
                      </code>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
