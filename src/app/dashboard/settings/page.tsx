"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function KeyStatus({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-terminal">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      saved
    </span>
  ) : (
    <span className="font-mono text-[11px] text-hint">not set</span>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useQuery(api.users.getCurrent);
  const updateKeys = useMutation(api.users.updateKeys);
  const connectGithub = useMutation(api.users.connectGithub);
  const disconnectGithub = useMutation(api.users.disconnectGithub);

  const [hetznerApiKey, setHetznerApiKey] = useState("");
  const [tailscaleApiKey, setTailscaleApiKey] = useState("");
  const [tailscaleTailnet, setTailscaleTailnet] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Only populate tailscaleTailnet (not a secret).
  // API keys are encrypted at rest — never sent back to the client.
  useEffect(() => {
    if (user) {
      setTailscaleTailnet(user.tailscaleTailnet || "");
    }
  }, [user]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    const githubStatus = searchParams.get("github");
    const githubErr = searchParams.get("github_error");

    if (githubErr) {
      const messages: Record<string, string> = {
        denied: "GitHub authorization was denied",
        invalid_state: "Invalid OAuth state — please try again",
        exchange_failed: "Failed to connect to GitHub — please try again",
      };
      setGithubError(messages[githubErr] || "GitHub connection failed");
      router.replace("/dashboard/settings");
      return;
    }

    if (githubStatus === "connected" && !githubConnecting) {
      setGithubConnecting(true);
      // Read the token from the httpOnly cookie via our API route
      fetch("/api/auth/github/token", { method: "POST" })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.token) {
            // Read username from the non-httpOnly cookie
            const username =
              document.cookie
                .split("; ")
                .find((c) => c.startsWith("github_username="))
                ?.split("=")[1] || "unknown";

            await connectGithub({
              accessToken: data.token,
              username: decodeURIComponent(username),
            });
          }
        })
        .catch((e) => {
          console.error("Failed to save GitHub token:", e);
          setGithubError("Failed to save GitHub connection");
        })
        .finally(() => {
          setGithubConnecting(false);
          router.replace("/dashboard/settings");
        });
    }
  }, [searchParams]);

  const savedKeys = [
    user?.hetznerApiKey,
    user?.tailscaleApiKey,
    user?.tailscaleTailnet,
  ].filter(Boolean).length;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      // Only send keys the user actually typed — empty fields are left unchanged
      await updateKeys({
        ...(hetznerApiKey ? { hetznerApiKey } : {}),
        ...(tailscaleApiKey ? { tailscaleApiKey } : {}),
        tailscaleTailnet,
      });
      // Clear key inputs after save (keys are encrypted, can't be shown again)
      setHetznerApiKey("");
      setTailscaleApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-terminal/60 tracking-widest uppercase mb-2">// config</p>
        <h1 className="text-2xl font-sans font-bold text-foreground">Settings</h1>
      </div>

      {/* Key Status Banner */}
      {user && (
        <div className={`mb-6 px-4 py-3 rounded-lg border font-mono text-xs flex items-center gap-3 ${
          savedKeys === 3
            ? "bg-terminal/5 border-terminal/20 text-terminal"
            : "bg-amber-400/5 border-amber-400/20 text-amber-400"
        }`}>
          <div className={`w-2 h-2 rounded-full shrink-0 ${savedKeys === 3 ? "bg-terminal" : "bg-amber-400"}`} />
          {savedKeys === 3 ? (
            "All keys configured — ready to deploy"
          ) : (
            <>{savedKeys} of 3 keys configured — add all keys to enable deployment</>
          )}
        </div>
      )}

      {/* GitHub Connection */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-muted-strong"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          <span className="font-mono text-xs text-muted-strong tracking-wide">GitHub</span>
        </div>

        <div className="p-5">
          {githubError && (
            <div className="mb-4 px-3 py-2 rounded border border-danger/20 bg-danger/5 font-mono text-xs text-danger">
              {githubError}
            </div>
          )}

          {user?.githubAccessToken ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-foreground/10 rounded-full flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-foreground"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </div>
                <div>
                  <p className="font-mono text-sm text-foreground">{user.githubUsername}</p>
                  <p className="font-mono text-[10px] text-muted">
                    Connected {user.githubConnectedAt ? new Date(user.githubConnectedAt).toLocaleDateString() : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (confirm("Disconnect GitHub? Servers will keep existing git credentials.")) {
                    await disconnectGithub();
                  }
                }}
                className="font-mono text-[11px] text-danger/70 hover:text-danger transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <p className="font-mono text-xs text-muted leading-relaxed mb-4">
                Connect your GitHub account so your servers can clone your repos. One-click setup — git credentials are auto-configured on every server you deploy.
              </p>
              <a
                href="/api/auth/github"
                className={`inline-flex items-center gap-2.5 font-mono text-xs font-semibold px-5 py-2.5 rounded border border-border-subtle bg-surface-raised hover:bg-foreground/10 text-foreground transition-all ${
                  githubConnecting ? "pointer-events-none opacity-40" : ""
                }`}
              >
                {githubConnecting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    Connect GitHub
                  </>
                )}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-strong"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <span className="font-mono text-xs text-muted-strong tracking-wide">API Keys</span>
        </div>

        <div className="p-5 space-y-6">
          <p className="font-mono text-xs text-muted leading-relaxed">
            Required for provisioning. You can save keys individually — all 3 are needed to deploy.
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[11px] text-muted-strong uppercase tracking-wider">
                Hetzner API Token
              </label>
              <KeyStatus configured={!!user?.hetznerApiKey} />
            </div>
            <input
              type="password"
              value={hetznerApiKey}
              onChange={(e) => setHetznerApiKey(e.target.value)}
              placeholder={user?.hetznerApiKey ? "••••••••  (encrypted — enter new value to replace)" : "paste-your-hetzner-api-token"}
              className="w-full p-3 rounded-lg"
            />
            <p className="font-mono text-[11px] text-hint mt-2">
              hetzner.com &rarr; Cloud Console &rarr; Security &rarr; API Tokens
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[11px] text-muted-strong uppercase tracking-wider">
                Tailscale API Key
              </label>
              <KeyStatus configured={!!user?.tailscaleApiKey} />
            </div>
            <input
              type="password"
              value={tailscaleApiKey}
              onChange={(e) => setTailscaleApiKey(e.target.value)}
              placeholder={user?.tailscaleApiKey ? "••••••••  (encrypted — enter new value to replace)" : "tskey-api-..."}
              className="w-full p-3 rounded-lg"
            />
            <p className="font-mono text-[11px] text-hint mt-2">
              login.tailscale.com &rarr; Settings &rarr; Keys
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[11px] text-muted-strong uppercase tracking-wider">
                Tailscale Tailnet ID
              </label>
              <KeyStatus configured={!!user?.tailscaleTailnet} />
            </div>
            <input
              type="text"
              value={tailscaleTailnet}
              onChange={(e) => setTailscaleTailnet(e.target.value)}
              placeholder="Tailnet ID, name, or '-' for personal"
              className="w-full p-3 rounded-lg"
            />
            <p className="font-mono text-[11px] text-hint mt-2">
              login.tailscale.com &rarr; Settings &rarr; General &rarr; Tailnet ID (or use &lsquo;-&rsquo; for personal)
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-terminal text-background font-mono text-xs font-semibold px-6 py-2.5 rounded hover:shadow-[0_0_20px_rgba(61,255,162,0.2)] disabled:opacity-40 transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Keys"
              )}
            </button>
            {saved && (
              <span className="font-mono text-xs text-terminal flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-surface border border-terminal/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-terminal/70"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
          <span className="font-mono text-xs text-terminal/80 tracking-wide">Quick Start</span>
        </div>
        <div className="p-5">
          <div className="space-y-3.5">
            {[
              "Add your Hetzner and Tailscale API keys above",
              <>Install Tailscale on your devices — <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="text-terminal/80 underline underline-offset-2 hover:text-terminal">tailscale.com/download</a></>,
              <>Add <code className="text-terminal/70 bg-terminal/5 px-1 py-0.5 rounded text-[10px]">tag:sshcode</code> to your Tailscale ACL — go to <a href="https://login.tailscale.com/admin/acls" target="_blank" rel="noopener noreferrer" className="text-terminal/80 underline underline-offset-2 hover:text-terminal">ACL settings</a> and add <code className="text-terminal/70 bg-terminal/5 px-1 py-0.5 rounded text-[10px]">{`"tagOwners": { "tag:sshcode": ["autogroup:admin"] }`}</code></>,
              <>Connect GitHub above <span className="text-muted">(optional — enables git clone on servers)</span></>,
              "Deploy a server from the dashboard",
              "Access your coding environment via Tailscale",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="font-mono text-[11px] text-terminal/50 pt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <p className="font-mono text-xs text-muted-strong leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
