"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, createGame } from "@/lib/api";

export function CreateGameButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onCreate() {
    setPending(true);

    try {
      const { data } = await createGame();
      router.push(`/game/${data.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "Could not create the game",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={onCreate} disabled={pending}>
      {pending ? "Creating…" : "New game"}
    </Button>
  );
}
