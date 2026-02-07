import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { EnsureUser } from "@/components/ensure-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      <nav className="border-b border-border-subtle bg-surface/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal shadow-[0_0_6px_rgba(61,255,162,0.5)] group-hover:shadow-[0_0_12px_rgba(61,255,162,0.8)] transition-all" />
            <span className="font-mono font-semibold text-xs tracking-wider text-foreground">SSHCode</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="font-mono text-[11px] tracking-wide text-muted hover:text-foreground hover:bg-surface-raised px-3 py-1.5 rounded transition-all"
            >
              servers
            </Link>
            <Link
              href="/dashboard/settings"
              className="font-mono text-[11px] tracking-wide text-muted hover:text-foreground hover:bg-surface-raised px-3 py-1.5 rounded transition-all"
            >
              settings
            </Link>
            <SignOutButton redirectUrl="/">
              <button className="font-mono text-[11px] tracking-wide text-muted hover:text-danger hover:bg-surface-raised px-3 py-1.5 rounded transition-all">
                sign_out
              </button>
            </SignOutButton>
          </div>
        </div>
      </nav>
      <EnsureUser />
      <main className="relative">{children}</main>
    </div>
  );
}
