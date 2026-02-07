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

      {/* Setup pipeline */}
      <SetupPipeline logs={logs} serverAgents={server.agents} serverStatus={server.status} />

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

function deduplicateLogs(logs: { _id: string; step: string; status: string; message?: string; timestamp: number }[]) {
  const byStep = new Map<string, typeof logs[number]>();
  for (const log of logs) {
    byStep.set(log.step, log);
  }
  return Array.from(byStep.values());
}

// ── Setup step definitions ──

const STEP_META: Record<string, { label: string; icon: string }> = {
  tailscale_auth_key: { label: "Create Tailscale auth key", icon: "key" },
  hetzner_create:     { label: "Provision Hetzner server", icon: "server" },
  setup_system_deps:  { label: "Install system packages", icon: "package" },
  setup_tailscale:    { label: "Connect Tailscale VPN", icon: "network" },
  setup_user_setup:   { label: "Configure server user", icon: "user" },
  setup_nodejs:       { label: "Install Node.js runtime", icon: "code" },
  setup_ttyd:         { label: "Install web terminal", icon: "terminal" },
  setup_firewall:     { label: "Configure firewall", icon: "shield" },
  setup_terminal:     { label: "Start web terminal", icon: "terminal" },
  setup_opencode:     { label: "Install OpenCode", icon: "grid" },
  setup_claude_code:  { label: "Install Claude Code", icon: "bot" },
  setup_codex:        { label: "Install Codex CLI", icon: "bot" },
};

function getExpectedSteps(agents: string[]): string[] {
  return [
    "tailscale_auth_key",
    "hetzner_create",
    "setup_system_deps",
    "setup_tailscale",
    "setup_user_setup",
    "setup_nodejs",
    "setup_ttyd",
    "setup_firewall",
    "setup_terminal",
    ...(agents.includes("opencode") ? ["setup_opencode"] : []),
    ...(agents.includes("claude-code") ? ["setup_claude_code"] : []),
    ...(agents.includes("codex") ? ["setup_codex"] : []),
  ];
}

function StepNodeIcon({ type, status }: { type: string; status: "success" | "running" | "error" | "pending" }) {
  const iconPaths: Record<string, React.ReactNode> = {
    key:      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />,
    server:   <><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></>,
    package:  <><path d="m16.5 9.4-9-5.19" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" x2="12" y1="22.08" y2="12" /></>,
    network:  <><rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" /><path d="M12 12V8" /></>,
    user:     <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    code:     <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
    terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></>,
    shield:   <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></>,
    grid:     <><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></>,
    bot:      <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></>,
  };

  const colors = {
    success: "text-terminal",
    running: "text-blue-400",
    error:   "text-danger",
    pending: "text-muted/25",
  };

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={colors[status]}
    >
      {iconPaths[type] || iconPaths.code}
    </svg>
  );
}

function SetupPipeline({
  logs,
  serverAgents,
  serverStatus,
}: {
  logs: { _id: string; step: string; status: string; message?: string; timestamp: number }[] | undefined;
  serverAgents: string[];
  serverStatus: string;
}) {
  const expected = getExpectedSteps(serverAgents);
  const logMap = new Map<string, { status: string; message?: string; timestamp: number }>();
  if (logs) {
    for (const log of logs) {
      logMap.set(log.step, { status: log.status, message: log.message, timestamp: log.timestamp });
    }
  }

  // Build the unified step list
  const steps = expected.map((stepId) => {
    const log = logMap.get(stepId);
    const meta = STEP_META[stepId] || { label: stepId, icon: "code" };
    let status: "success" | "running" | "error" | "pending" = "pending";
    if (log) {
      if (log.status === "success") status = "success";
      else if (log.status === "running") status = "running";
      else if (log.status === "error") status = "error";
    }
    return { id: stepId, ...meta, status, message: log?.message, timestamp: log?.timestamp };
  });

  const completedCount = steps.filter((s) => s.status === "success").length;
  const hasError = steps.some((s) => s.status === "error");
  const isComplete = serverStatus === "running";

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span className="font-mono text-[11px] text-muted tracking-wide">Setup Pipeline</span>
        </div>
        <span className="font-mono text-[10px] text-muted/60">
          {hasError ? "failed" : isComplete ? "complete" : `${completedCount}/${steps.length}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-border-subtle rounded-full mb-5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            hasError ? "bg-danger" : isComplete ? "bg-terminal" : "bg-blue-400"
          }`}
          style={{ width: `${Math.max((completedCount / steps.length) * 100, 2)}%` }}
        />
      </div>

      {/* Pipeline steps */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <div className="relative">
          {/* Vertical trace line */}
          <div className="absolute left-[23px] top-0 bottom-0 w-[1px] bg-border-subtle" />

          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;

            return (
              <div key={step.id} className={`relative flex items-center gap-3 px-3 py-2.5 ${
                !isLast ? "border-b border-border-subtle/50" : ""
              } ${step.status === "running" ? "bg-blue-400/[0.03]" : step.status === "error" ? "bg-danger/[0.03]" : ""}`}>
                {/* Node on the trace */}
                <div className="relative z-10 flex items-center justify-center w-[22px] shrink-0">
                  {step.status === "success" ? (
                    <div className="w-[18px] h-[18px] rounded-full bg-terminal/10 border border-terminal/25 flex items-center justify-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-terminal"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  ) : step.status === "running" ? (
                    <div className="w-[18px] h-[18px] rounded-full bg-blue-400/10 border border-blue-400/25 flex items-center justify-center">
                      <div className="w-[8px] h-[8px] border-[1.5px] border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    </div>
                  ) : step.status === "error" ? (
                    <div className="w-[18px] h-[18px] rounded-full bg-danger/10 border border-danger/25 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                    </div>
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full bg-muted/[0.06] border border-border-subtle flex items-center justify-center">
                      <div className="w-[5px] h-[5px] rounded-full bg-muted/20" />
                    </div>
                  )}
                </div>

                {/* Icon + label */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <StepNodeIcon type={step.icon} status={step.status} />
                  <div className="flex-1 min-w-0">
                    <span className={`font-mono text-[11px] leading-none ${
                      step.status === "success" ? "text-foreground"
                      : step.status === "running" ? "text-blue-400"
                      : step.status === "error" ? "text-danger"
                      : "text-muted/40"
                    }`}>
                      {step.label}
                    </span>
                    {step.message && step.status === "error" && (
                      <p className="font-mono text-[10px] text-danger/60 mt-0.5 truncate">{step.message}</p>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                {step.timestamp && step.status === "success" && (
                  <span className="font-mono text-[10px] text-muted/30 shrink-0 tabular-nums">
                    {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                {step.status === "running" && (
                  <span className="font-mono text-[10px] text-blue-400/50 shrink-0 tracking-wider">
                    ...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  return STEP_META[step]?.label || step;
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
