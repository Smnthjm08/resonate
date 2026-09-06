"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  accountLabel,
  authClient,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_PATTERN,
  useSession,
} from "@/lib/auth-client";

export type AuthMode = "signin" | "signup";

function validateUsername(username: string) {
  if (username.length < MIN_USERNAME_LENGTH)
    return `Username needs at least ${MIN_USERNAME_LENGTH} characters.`;
  if (username.length > MAX_USERNAME_LENGTH)
    return `Username can be at most ${MAX_USERNAME_LENGTH} characters.`;
  if (!USERNAME_PATTERN.test(username))
    return "Username can only use letters, numbers, underscores and dots.";
  return null;
}

export function AuthPanel({
  defaultMode = "signin",
  next = "/lobby",
}: {
  defaultMode?: AuthMode;
  next?: string;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [pending, setPending] = useState<null | "guest" | AuthMode>(null);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const user = session?.user ?? null;
  const guest = user?.isAnonymous ? user : null;

  function onDone() {
    router.push(next);
    router.refresh();
  }

  async function playAsGuest() {
    setError(null);
    setPending("guest");

    const { error: signInError } = await authClient.signIn.anonymous();

    setPending(null);
    if (signInError) {
      setError(signInError.message ?? "Could not start a guest session.");
      return;
    }

    onDone();
  }

  async function onSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const handle = identifier.trim();
    if (!handle || !signInPassword) {
      setError("Enter your username or email and your password.");
      return;
    }

    setPending("signin");

    // The username plugin adds its own endpoint; email sign-in stays on the
    // core one, so the field is routed on whether it looks like an address.
    const { error: signInError } = handle.includes("@")
      ? await authClient.signIn.email({
          email: handle,
          password: signInPassword,
        })
      : await authClient.signIn.username({
          username: handle,
          password: signInPassword,
        });

    setPending(null);
    if (signInError) {
      setError(signInError.message ?? "Could not sign you in.");
      return;
    }

    onDone();
  }

  async function onSignUp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const handle = username.trim();
    const address = email.trim();

    const usernameError = validateUsername(handle);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (!address.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (signUpPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPending("signup");

    // With a guest session in the cookie, Better Auth links the two accounts
    // and `onLinkAccount` moves the guest's games onto this one.
    const { error: signUpError } = await authClient.signUp.email({
      email: address,
      password: signUpPassword,
      username: handle,
      name: handle,
    });

    setPending(null);
    if (signUpError) {
      setError(signUpError.message ?? "Could not create the account.");
      return;
    }

    onDone();
  }

  // The signed-in cases only settle once the session resolves on the client;
  // the form is what renders on the server, which is the common case anyway.
  if (user && !guest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Already signed in</CardTitle>
          <CardDescription>
            You are signed in as {accountLabel(user)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button nativeButton={false} render={<Link href={next} />}>
            Continue
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut();
              router.refresh();
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{guest ? "Keep your games" : "Sign in"}</CardTitle>
        <CardDescription>
          {guest
            ? `You are playing as ${accountLabel(guest)}. Create an account and the games you have already played come with you.`
            : "A guest account is enough to play — pick a username only if you want the games to stay yours."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {guest ? (
          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link href={next} />}
          >
            Keep playing as {accountLabel(guest)}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={playAsGuest}
            disabled={pending !== null || sessionPending}
          >
            {pending === "guest" ? "Starting…" : "Play as guest"}
          </Button>
        )}

        <FieldSeparator>or</FieldSeparator>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as AuthMode);
            setError(null);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="pt-4">
            <form className="space-y-4" onSubmit={onSignIn}>
              <Field>
                <FieldLabel htmlFor="identifier">Username or email</FieldLabel>
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="signin-password">Password</FieldLabel>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                />
              </Field>

              {mode === "signin" && error && <FieldError>{error}</FieldError>}

              <Button
                type="submit"
                className="w-full"
                disabled={pending !== null}
              >
                {pending === "signin" ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="pt-4">
            <form className="space-y-4" onSubmit={onSignUp}>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <FieldDescription>
                  Letters, numbers, underscores and dots. This is the name at
                  the board.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={signUpPassword}
                  onChange={(event) => setSignUpPassword(event.target.value)}
                />
                <FieldDescription>
                  At least {MIN_PASSWORD_LENGTH} characters.
                </FieldDescription>
              </Field>

              {mode === "signup" && error && <FieldError>{error}</FieldError>}

              <Button
                type="submit"
                className="w-full"
                disabled={pending !== null}
              >
                {pending === "signup"
                  ? "Creating…"
                  : guest
                    ? "Create account and keep my games"
                    : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
