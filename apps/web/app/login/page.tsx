import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="min-h-svh">
      <SiteHeader />

      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              A guest account is enough to play — pick a username only if you
              want the games to stay yours.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Button className="w-full" disabled>
              Play as guest
            </Button>

            <FieldSeparator>or</FieldSeparator>

            <form className="space-y-4">
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input id="username" name="username" autoComplete="username" />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                />
              </Field>

              <Button type="submit" variant="secondary" className="w-full" disabled>
                Continue
              </Button>
            </form>

            <p className="text-muted-foreground text-center text-xs">
              Sign-in is wired up with the Better Auth client — until then,{" "}
              <Link href="/lobby" className="text-primary underline">
                browse the lobby
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
