import { cn } from "@/lib/utils";

const PIECES: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Expands the FEN placement field into 64 squares, rank 8 first. */
function toSquares(fen: string): (string | null)[] {
  const placement = fen.split(" ")[0] ?? "";

  return placement.split("/").flatMap((rank) =>
    [...rank].flatMap((char) =>
      /\d/.test(char) ? Array<null>(Number(char)).fill(null) : [char],
    ),
  );
}

export function Board({
  fen,
  orientation = "white",
}: {
  fen: string;
  orientation?: "white" | "black";
}) {
  const squares = toSquares(fen);
  const ordered = orientation === "black" ? [...squares].reverse() : squares;

  return (
    <div className="border-hairline grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border">
      {ordered.map((piece, index) => {
        const rank = Math.floor(index / 8);
        const file = index % 8;
        const isLight = (rank + file) % 2 === 0;
        const name =
          orientation === "black"
            ? `${FILES[7 - file]}${rank + 1}`
            : `${FILES[file]}${8 - rank}`;

        return (
          <div
            key={name}
            className={cn(
              "flex items-center justify-center text-[clamp(1.5rem,5vw,2.75rem)] leading-none",
              isLight ? "bg-surface-elevated" : "bg-surface-card",
            )}
          >
            {piece && (
              <span className={piece === piece.toUpperCase() ? "text-white" : "text-black"}>
                {PIECES[piece]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
