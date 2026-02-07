"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";

const ALL_AGENTS = [
  { id: "opencode" as const, label: "OpenCode", description: "AI-powered code editor in the browser", port: 4096 },
  { id: "claude-code" as const, label: "Claude Code", description: "Claude Code terminal via ttyd", port: 4097 },
  { id: "codex" as const, label: "Codex CLI", description: "OpenAI Codex terminal via ttyd", port: 4100 },
];

export default function ServerDetail() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as Id<"servers">;

  const server = useQuery(api.servers.get, { serverId });
  const logs = useQuery(api.servers.getLogs, { serverId });
  const deleteServer = useAction(api.provisioning.deleteServer);
  const installAgent = useAction(api.provisioning.installAgent);
  const uninstallAgent = useAction(api.provisioning.uninstallAgent);

  const resetCredentials = useAction(api.provisioning.resetCredentials);

  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [showCredReset, setShowCredReset] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Redirect if server not found / deleted
  useEffect(() => {
    if (server === null) {
      router.push("/dashboard");
    }
  }, [server, router]);

  // server === undefined means still loading; null means not found / deleted
  if (server === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 border-2 border-terminal/30 border-t-terminal rounded-full animate-spin" />
          <span className="font-mono text-xs text-muted">Loading server...</span>
        </div>
      </div>
    );
  }

  if (server === null) {
    return null;
  }

  async function handleResetCredentials() {
    setCredError(null);
    setCredSuccess(false);
    setCredLoading(true);
    try {
      await resetCredentials({ serverId, username: newUsername, password: newPassword });
      setCredSuccess(true);
      setNewUsername("");
      setNewPassword("");
      setTimeout(() => { setCredSuccess(false); setShowCredReset(false); }, 2000);
    } catch (e: any) {
      setCredError(e.message || "Reset failed");
    } finally {
      setCredLoading(false);
    }
  }

  async function handleInstall(agent: "opencode" | "claude-code" | "codex") {
    setAgentError(null);
    setAgentLoading(agent);
    try {
      await installAgent({ serverId, agent });
    } catch (e: any) {
      setAgentError(e.message || "Install failed");
    } finally {
      setAgentLoading(null);
    }
  }

  function handleUninstall(agent: "opencode" | "claude-code" | "codex") {
    const label = ALL_AGENTS.find((a) => a.id === agent)?.label || agent;
    setConfirmModal({
      title: `Remove ${label}`,
      message: `This will stop and disable ${label}. You can reinstall it later.`,
      confirmLabel: "Remove",
      onConfirm: async () => {
        setConfirmModal(null);
        setAgentError(null);
        setAgentLoading(agent);
        try {
          await uninstallAgent({ serverId, agent });
        } catch (e: any) {
          setAgentError(e.message || "Uninstall failed");
        } finally {
          setAgentLoading(null);
        }
      },
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard" className="font-mono text-[11px] text-muted hover:text-foreground transition-colors">
          servers
        </Link>
        <span className="font-mono text-[11px] text-muted/30">/</span>
        <span className="font-mono text-[11px] text-terminal">
          {server.tailscaleName || "server"}
        </span>
      </div>

      {/* Server header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2 h-2 rounded-full ${
              server.status === "running" ? "bg-terminal shadow-[0_0_8px_rgba(61,255,162,0.5)]"
              : server.status === "error" ? "bg-danger"
              : server.status === "provisioning" || server.status === "installing" ? "bg-blue-400 animate-pulse"
              : "bg-muted/40"
            }`} />
            <h1 className="font-mono text-lg text-foreground font-semibold">
              {server.tailscaleName || "Server"}
            </h1>
          </div>
          <p className="font-mono text-[11px] text-muted">
            {server.agents.length > 0 ? server.agents.join(" + ") : "no agents"}
            <span className="text-border-subtle mx-2">|</span>
            {server.region}
            <span className="text-border-subtle mx-2">|</span>
            {server.serverType}
          </p>
        </div>
        <StatusChip status={server.status} health={server.healthStatus} />
      </div>

      {/* Connection info */}
      {(server.status === "running" || server.status === "installing") && server.tailscaleName && (
        <div className="bg-surface border border-terminal/15 rounded-lg overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-terminal"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
            <span className="font-mono text-[11px] text-terminal tracking-wide">Connection Info</span>
          </div>
          <div className="p-5 space-y-4">
            {server.agents.includes("opencode") && (
              <CopyField
                label="OpenCode Web UI"
                value={`http://${server.tailscaleName}.${server.tailscaleDomain || "tailnet.ts.net"}:${server.opencodePort || 4096}`}
                color="terminal"
              />
            )}
            {server.agents.includes("claude-code") && (
              <CopyField
                label="Claude Code Terminal"
                value={`http://${server.tailscaleName}.${server.tailscaleDomain || "tailnet.ts.net"}:${server.claudeCodePort || 4097}`}
                color="terminal"
              />
            )}
            {server.agents.includes("codex") && (
              <CopyField
                label="Codex CLI Terminal"
                value={`http://${server.tailscaleName}.${server.tailscaleDomain || "tailnet.ts.net"}:${server.codexPort || 4100}`}
                color="terminal"
              />
            )}
            <CopyField
              label="Web Terminal (bash)"
              value={`http://${server.tailscaleName}.${server.tailscaleDomain || "tailnet.ts.net"}:4099`}
              color="terminal"
            />
            <div className="grid grid-cols-2 gap-4">
              <CopyField label="Username" value={server.serverUsername || "sshcode"} />
              <CopyField label="Password" value={server.serverPassword} />
            </div>
          </div>
        </div>
      )}

      {/* Agents management */}
      {server.status === "running" && (
        <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>
            <span className="font-mono text-[11px] text-muted tracking-wide">Agents</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {ALL_AGENTS.map((agent) => {
              const isInstalled = server.agents.includes(agent.id);
              const isLoading = agentLoading === agent.id;

              return (
                <div key={agent.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isInstalled ? "bg-terminal" : "bg-muted/30"}`} />
                    <div>
                      <p className="font-mono text-xs text-foreground">{agent.label}</p>
                      <p className="font-mono text-[10px] text-muted mt-0.5">{agent.description}</p>
                    </div>
                  </div>
                  <div className="shrink-0 ml-4">
                    {isLoading ? (
                      <div className="flex items-center gap-2 px-4 py-1.5">
                        <div className="w-3 h-3 border-2 border-terminal/30 border-t-terminal rounded-full animate-spin" />
                        <span className="font-mono text-[10px] text-muted">
                          {isInstalled ? "Removing..." : "Installing..."}
                        </span>
                      </div>
                    ) : isInstalled ? (
                      <button
                        onClick={() => handleUninstall(agent.id)}
                        disabled={!!agentLoading}
                        className="font-mono text-[10px] text-danger/70 border border-danger/15 bg-danger/5 px-3 py-1.5 rounded hover:bg-danger/10 hover:text-danger transition-all disabled:opacity-40"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstall(agent.id)}
                        disabled={!!agentLoading}
                        className="font-mono text-[10px] text-terminal border border-terminal/20 bg-terminal/5 px-3 py-1.5 rounded hover:bg-terminal/10 transition-all disabled:opacity-40"
                      >
                        Install
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {agentError && (
            <div className="px-5 py-3 border-t border-danger/10 bg-danger/5">
              <p className="font-mono text-[10px] text-danger">{agentError}</p>
            </div>
          )}
        </div>
      )}

      {/* Credentials reset */}
      {server.status === "running" && (
        <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span className="font-mono text-[11px] text-muted tracking-wide">Credentials</span>
            </div>
            {!showCredReset && (
              <button
                onClick={() => { setShowCredReset(true); setNewUsername(server.serverUsername || "sshcode"); setNewPassword(""); setCredError(null); setCredSuccess(false); }}
                className="font-mono text-[10px] text-muted hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          {showCredReset && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] text-muted uppercase tracking-wider block mb-1.5">New Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="sshcode"
                    className="w-full font-mono text-sm bg-background text-foreground px-3 py-2 rounded border border-border-subtle focus:border-terminal/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted uppercase tracking-wider block mb-1.5">New Password</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="min 8 characters"
                    className="w-full font-mono text-sm bg-background text-foreground px-3 py-2 rounded border border-border-subtle focus:border-terminal/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {credError && (
                <p className="font-mono text-[10px] text-danger">{credError}</p>
              )}
              {credSuccess && (
                <p className="font-mono text-[10px] text-terminal">Credentials updated successfully</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleResetCredentials}
                  disabled={credLoading || !newUsername || newPassword.length < 8}
                  className="font-mono text-[10px] text-terminal border border-terminal/20 bg-terminal/5 px-4 py-1.5 rounded hover:bg-terminal/10 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {credLoading && <div className="w-3 h-3 border-2 border-terminal/30 border-t-terminal rounded-full animate-spin" />}
                  {credLoading ? "Updating..." : "Update Credentials"}
                </button>
                <button
                  onClick={() => { setShowCredReset(false); setCredError(null); }}
                  disabled={credLoading}
                  className="font-mono text-[10px] text-muted hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      {server.statusMessage && server.status !== "running" && (
        <div className={`font-mono text-xs px-4 py-3 rounded-lg border mb-8 ${
          server.status === "error"
            ? "text-danger bg-danger/5 border-danger/15"
            : "text-muted bg-surface border-border-subtle"
        }`}>
          {server.statusMessage}
        </div>
      )}

      {/* Provisioning logs */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span className="font-mono text-[11px] text-muted tracking-wide">Setup Log</span>
        </div>
        <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
          {logs && logs.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {deduplicateLogs(logs).map((log) => (
                <div key={log._id} className="flex items-start gap-4 px-5 py-3.5">
                  <StepIcon status={log.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-foreground">{formatStep(log.step)}</p>
                    {log.message && (
                      <p className="font-mono text-[10px] text-muted mt-0.5 truncate">{log.message}</p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-muted/40 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="font-mono text-xs text-muted/50">No log entries yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Danger zone */}
      <div className="border border-danger/10 rounded-lg p-5 bg-danger/[0.02]">
        <p className="font-mono text-[10px] text-danger/60 uppercase tracking-wider mb-3">Danger Zone</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-foreground">Delete this server</p>
            <p className="font-mono text-[10px] text-muted mt-0.5">Permanently removes the server from Hetzner and SSHCode</p>
          </div>
          <button
            onClick={() => {
              setConfirmModal({
                title: "Delete Server",
                message: "This will permanently destroy the server on Hetzner and remove all data. This cannot be undone.",
                confirmLabel: "Delete Server",
                onConfirm: async () => {
                  setConfirmModal(null);
                  await deleteServer({ serverId });
                  router.push("/dashboard");
                },
              });
            }}
            className="font-mono text-[11px] text-danger border border-danger/20 bg-danger/5 px-4 py-2 rounded hover:bg-danger/10 transition-all shrink-0"
          >
            Delete Server
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status, health }: { status: string; health?: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    running: {
      bg: health === "healthy" ? "bg-terminal/10 border-terminal/20" : "bg-amber-400/10 border-amber-400/20",
      text: health === "healthy" ? "text-terminal" : "text-amber-400",
      dot: health === "healthy" ? "bg-terminal" : "bg-amber-400",
      label: health === "healthy" ? "running" : "degraded",
    },
    provisioning: { bg: "bg-blue-400/10 border-blue-400/20", text: "text-blue-400", dot: "bg-blue-400 animate-pulse", label: "provisioning" },
    installing: { bg: "bg-blue-400/10 border-blue-400/20", text: "text-blue-400", dot: "bg-blue-400 animate-pulse", label: "installing" },
    error: { bg: "bg-danger/10 border-danger/20", text: "text-danger", dot: "bg-danger", label: "error" },
    stopped: { bg: "bg-muted/10 border-muted/20", text: "text-muted", dot: "bg-muted/50", label: "stopped" },
    deleting: { bg: "bg-amber-400/10 border-amber-400/20", text: "text-amber-400", dot: "bg-amber-400", label: "deleting" },
  };
  const c = config[status] || config.stopped;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 rounded border ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "success") {
    return (
      <div className="w-5 h-5 rounded-full bg-terminal/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-terminal"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="w-5 h-5 rounded-full bg-blue-400/10 flex items-center justify-center shrink-0 mt-0.5">
        <div className="w-2 h-2 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="w-5 h-5 rounded-full bg-danger/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-muted/10 flex items-center justify-center shrink-0 mt-0.5">
      <div className="w-1.5 h-1.5 rounded-full bg-muted/30" />
    </div>
  );
}

function deduplicateLogs(logs: { _id: string; step: string; status: string; message?: string; timestamp: number }[]) {
  const byStep = new Map<string, typeof logs[number]>();
  for (const log of logs) {
    byStep.set(log.step, log);
  }
  return Array.from(byStep.values());
}

function CopyField({ label, value, color }: { label: string; value: string; color?: "terminal" | "foreground" }) {
  const [copied, setCopied] = useState(false);
  const textColor = color === "terminal" ? "text-terminal" : "text-foreground";

  return (
    <div>
      <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">{label}</p>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="w-full text-left font-mono text-sm bg-background px-3 py-2 rounded border border-border-subtle flex items-center justify-between gap-2 group hover:border-terminal/30 transition-all cursor-pointer"
      >
        <span className={`${textColor} truncate`}>{value}</span>
        <span className="shrink-0">
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40 group-hover:text-muted transition-colors"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          )}
        </span>
      </button>
    </div>
  );
}

function formatStep(step: string): string {
  const labels: Record<string, string> = {
    tailscale_auth_key: "Create Tailscale auth key",
    hetzner_create: "Provision Hetzner server",
    software_install: "Install AI agents",
  };
  return labels[step] || step;
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h3 className="font-mono text-sm text-foreground font-semibold mb-2">{title}</h3>
          <p className="font-mono text-xs text-muted leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-background/50">
          <button
            onClick={onCancel}
            className="font-mono text-[11px] text-muted hover:text-foreground px-4 py-2 rounded border border-border-subtle hover:border-muted/40 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="font-mono text-[11px] text-white bg-danger px-4 py-2 rounded hover:brightness-110 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
