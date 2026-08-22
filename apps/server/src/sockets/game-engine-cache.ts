import { createEngine, type ChessEngine } from "@repo/game-core";

export class GameEngineCache {
  private readonly instances = new Map<string, ChessEngine>();

  getOrHydrate(gameId: string, fen: string): ChessEngine {
    let engine = this.instances.get(gameId);

    if (!engine) {
      engine = createEngine(fen);
      this.instances.set(gameId, engine);
    }

    return engine;
  }

  evict(gameId: string): void {
    this.instances.delete(gameId);
  }
}

export const gameEngineCache = new GameEngineCache();
