import { Chess, DEFAULT_POSITION } from "chess.js";

export type ChessEngine = Chess;

export type Turn = "white" | "black";

export const START_FEN = DEFAULT_POSITION;

export function createEngine(fen?: string): Chess {
  return new Chess(fen ?? START_FEN);
}

/**
 * The side to move, read straight from the FEN's active-colour field.
 *
 * Compared against the literal `"w"` rather than the `WHITE` constant because
 * `constants.ts` re-exports `START_FEN` from this module, and importing it back
 * would make the two files circular.
 */
export function getActiveTurn(fen: string): Turn {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

export function tryMove(
  engine: Chess,
  move: { from: string; to: string; promotion?: string },
): {
  fen: string;
  san: string;
  from: string;
  to: string;
  promotion?: string;
} | null {
  try {
    const moveResult = engine.move(move);

    if (!moveResult) return null;

    return {
      fen: engine.fen(),
      san: moveResult.san,
      from: moveResult.from,
      to: moveResult.to,
      promotion: moveResult.promotion,
    };
  } catch {
    return null;
  }
}

export function getOutcome(engine: Chess): {
  isGameOver: boolean;
  result:
    | "CHECKMATE"
    | "STALEMATE"
    | "THREEFOLD_REPETITION"
    | "INSUFFICIENT_MATERIAL"
    | "FIFTY_MOVE_RULE"
    | null;
  winner: "white" | "black" | null;
} {
  if (!engine.isGameOver()) {
    return {
      isGameOver: false,
      result: null,
      winner: null,
    };
  }

  if (engine.isCheckmate()) {
    const winner = engine.turn() === "w" ? "black" : "white";

    return {
      isGameOver: true,
      result: "CHECKMATE",
      winner,
    };
  }

  if (engine.isStalemate()) {
    return {
      isGameOver: true,
      result: "STALEMATE",
      winner: null,
    };
  }

  if (engine.isThreefoldRepetition()) {
    return {
      isGameOver: true,
      result: "THREEFOLD_REPETITION",
      winner: null,
    };
  }

  if (engine.isInsufficientMaterial()) {
    return {
      isGameOver: true,
      result: "INSUFFICIENT_MATERIAL",
      winner: null,
    };
  }

  if (engine.isDrawByFiftyMoves()) {
    return {
      isGameOver: true,
      result: "FIFTY_MOVE_RULE",
      winner: null,
    };
  }

  return {
    isGameOver: true,
    result: null,
    winner: null,
  };
}
