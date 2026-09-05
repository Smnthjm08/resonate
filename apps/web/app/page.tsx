import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const packages = [
  { name: "apps/web", detail: "Next.js client" },
  { name: "apps/server", detail: "WebSocket game server" },
  { name: "packages/game-core", detail: "Chess engine" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <Badge variant="secondary">Work in progress</Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Chess
        </h1>
        <p className="text-muted-foreground text-lg">
          Real-time multiplayer chess, built on a Turborepo monorepo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>What lives where in this repo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {packages.map((pkg, i) => (
            <div key={pkg.name}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-center justify-between gap-4">
                <code className="font-mono text-sm">{pkg.name}</code>
                <span className="text-muted-foreground text-sm">
                  {pkg.detail}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter className="gap-2">
          <Button render={<Link href="/lobby" />}>Open lobby</Button>
          <Button variant="outline" render={<Link href="/login" />}>
            Sign in
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
