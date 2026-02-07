"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";

export default function Dashboard() {
  const servers = useQuery(api.servers.list);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <p className="font-mono text-[10px] text-terminal/50 tracking-widest uppercase mb-2">// dashboard</p>
          <h1 className="text-2xl font-sans font-bold text-foreground">Your Servers</h1>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 bg-terminal text-background font-mono text-xs font-semibold px-5 py-2.5 rounded hover:shadow-[0_0_20px_rgba(61,255,162,0.2)] transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          New Server
        </Link>
      </div>

      {/* Empty state */}
      {servers?.length === 0 && (
        <div className="border border-dashed border-border-subtle rounded-lg py-24 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-lg bg-surface-raised border border-border-subtle flex items-center justify-center mb-6">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
          </div>
          <p className="text-muted text-sm mb-1">No servers deployed</p>
          <p className="text-muted/50 text-xs mb-6 font-mono">Run your first AI coding environment</p>
          <Link
            href="/dashboard/new"
            className="font-mono text-xs text-terminal border border-terminal/20 bg-terminal/5 px-5 py-2 rounded hover:bg-terminal/10 transition-all"
          >
            Deploy Server
          </Link>
        </div>
      )}

      {/* Server list */}
      {servers && servers.length > 0 && (
        <div className="space-y-3">
          {servers.map((server) => (
            <Link
              key={server._id}
              href={`/dashboard/servers/${server._id}`}
              className="card-glow block rounded-lg p-5 group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    server.status === "running" && server.healthStatus === "healthy"
                      ? "bg-terminal shadow-[0_0_6px_rgba(61,255,162,0.5)]"
                      : server.status === "running"
                        ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                        : server.status === "provisioning" || server.status === "installing"
                          ? "bg-blue-400 animate-pulse"
                          : server.status === "error"
                            ? "bg-danger"
                            : "bg-muted/40"
                  }`} />
                  <div>
                    <p className="font-mono text-sm text-foreground group-hover:text-terminal transition-colors">
                      {server.tailscaleName || server.hetznerServerId || "server"}
                    </p>
                    <p className="font-mono text-[11px] text-muted mt-1">
                      {server.agents.join(" + ")}
                      <span className="text-border-subtle mx-2">|</span>
                      {server.region}
                      <span className="text-border-subtle mx-2">|</span>
                      {server.serverType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={server.status} health={server.healthStatus} />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/30 group-hover:text-terminal/50 transition-colors"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, health }: { status: string; health?: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    running: {
      bg: health === "healthy" ? "bg-terminal/10" : "bg-amber-400/10",
      text: health === "healthy" ? "text-terminal" : "text-amber-400",
      label: health === "healthy" ? "running" : "degraded",
    },
    provisioning: { bg: "bg-blue-400/10", text: "text-blue-400", label: "provisioning" },
    installing: { bg: "bg-blue-400/10", text: "text-blue-400", label: "installing" },
    error: { bg: "bg-danger/10", text: "text-danger", label: "error" },
    stopped: { bg: "bg-muted/10", text: "text-muted", label: "stopped" },
    deleting: { bg: "bg-amber-400/10", text: "text-amber-400", label: "deleting" },
  };
  const c = config[status] || config.stopped;
  return (
    <span className={`font-mono text-[10px] tracking-wider uppercase px-2.5 py-1 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
