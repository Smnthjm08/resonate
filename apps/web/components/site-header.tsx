"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { accountLabel, authClient, useSession } from "@/lib/auth-client";

function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  if (isPending) return <Skeleton className="h-7 w-24" />;

  const user = session?.user;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/login?next=${encodeURIComponent(pathname)}`} />}
        >
          Sign in
        </Button>
        <Button
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/signup?next=${encodeURIComponent(pathname)}`} />
          }
        >
          Create account
        </Button>
      </div>
    );
  }

  async function onSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    setSigningOut(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {user.isAnonymous && (
        <Button
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/signup?next=${encodeURIComponent(pathname)}`} />
          }
        >
          Save your games
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" variant="outline" disabled={signingOut}>
              {accountLabel(user)}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {user.isAnonymous ? "Guest account" : accountLabel(user)}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="border-hairline border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="text-title-sm font-semibold tracking-tight">
          Chess
        </Link>

        <nav className="text-muted-foreground flex items-center gap-4 text-sm">
          <Link
            href="/lobby"
            className="hover:text-foreground transition-colors"
          >
            Lobby
          </Link>
        </nav>

        <div className="ml-auto">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
