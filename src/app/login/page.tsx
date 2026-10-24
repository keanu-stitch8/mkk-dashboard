import Link from "next/link";
import type { Metadata } from "next";
import { MkkLogo } from "@/components/MkkLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authConfigured, authRequired, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in · MKK Analytics" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  password: "Wrong password. Ask the dashboard admin for the team password.",
  name: "Enter your name — it's shown next to the matches you confirm.",
  "too-many": "Too many attempts. Wait 15 minutes and try again.",
  "not-configured": "Sign-in isn't set up on this server yet (DASHBOARD_PASSWORD is empty).",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const configured = authConfigured();

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <MkkLogo className="mx-auto mb-2 size-10 text-primary" />
          <CardTitle className="text-xl">MKK Analytics</CardTitle>
          <CardDescription>Sign in with your name and the team password.</CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              {authRequired() ? (
                <p>{ERRORS["not-configured"]} Set it in the server&apos;s .env and restart.</p>
              ) : (
                <>
                  <p>Sign-in is off on this computer: DASHBOARD_PASSWORD isn&apos;t set, so the dashboard is open. Set it before putting the dashboard on a server.</p>
                  <Button asChild variant="secondary">
                    <Link href={next}>Open the dashboard</Link>
                  </Button>
                </>
              )}
            </div>
          ) : (
            <form action="/api/auth/login" method="post" className="flex flex-col gap-4">
              <input type="hidden" name="next" value={next} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" autoComplete="name" required maxLength={40} placeholder="e.g. Indah" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Team password</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
