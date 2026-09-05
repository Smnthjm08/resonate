import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-hairline border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="text-title-sm font-semibold tracking-tight">
          Chess
        </Link>

        <nav className="text-muted-foreground flex items-center gap-4 text-sm">
          <Link href="/lobby" className="hover:text-foreground transition-colors">
            Lobby
          </Link>
        </nav>

        <Button size="sm" className="ml-auto" render={<Link href="/login" />}>
          Sign in
        </Button>
      </div>
    </header>
  );
}
