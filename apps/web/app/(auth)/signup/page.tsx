import { SiteHeader } from "@/components/site-header";
import { AuthPanel } from "@/components/auth/auth-panel";
import { safeNext } from "@/lib/next-path";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="min-h-svh">
      <SiteHeader />

      <main className="mx-auto max-w-md px-6 py-16">
        <AuthPanel defaultMode="signup" next={safeNext(next)} />
      </main>
    </div>
  );
}
