"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewServer() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrent);
  const provision = useAction(api.provisioning.provisionServer);
  const [loading, setLoading] = useState(false);

  const regions = [
    { value: "ash" as const, label: "Ashburn, VA", sub: "US East" },
    { value: "hil" as const, label: "Hillsboro, OR", sub: "US West" },
    { value: "nbg1" as const, label: "Nuremberg", sub: "Germany" },
    { value: "hel1" as const, label: "Helsinki", sub: "Finland" },
  ];

  const isUSRegion = (r: string) => r === "ash" || r === "hil";

  const serverSizes = (region: string) => isUSRegion(region)
    ? [
        { value: "cpx21" as const, label: "Small", specs: "3 vCPU / 4GB RAM", price: "~$11/mo" },
        { value: "cpx31" as const, label: "Medium", specs: "4 vCPU / 8GB RAM", price: "~$19/mo" },
      ]
    : [
        { value: "cx23" as const, label: "Small", specs: "2 vCPU / 4GB RAM", price: "~$4/mo" },
        { value: "cx33" as const, label: "Medium", specs: "4 vCPU / 8GB RAM", price: "~$7/mo" },
      ];

  const [form, setForm] = useState<{
    region: "ash" | "hil" | "nbg1" | "fsn1" | "hel1";
    serverType: "cx23" | "cx33" | "cpx21" | "cpx31";
    agents: ("opencode" | "claude-code")[];
  }>({
    region: "ash",
    serverType: "cpx21",
    agents: ["opencode"],
  });

  const missing: string[] = [];
  if (!user?.hetznerApiKey) missing.push("Hetzner API Token");
  if (!user?.tailscaleApiKey) missing.push("Tailscale API Key");
  if (!user?.tailscaleTailnet) missing.push("Tailscale Tailnet ID");
  const missingKeys = missing.length > 0;

  async function handleSubmit() {
    setLoading(true);
    try {
      await provision({
        region: form.region,
        serverType: form.serverType,
        agents: form.agents,
      });
      router.push("/dashboard");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (missingKeys) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="bg-surface border border-border-subtle rounded-lg p-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          </div>
          <h2 className="text-lg font-sans font-semibold text-foreground mb-2">Setup Required</h2>
          <p className="text-muted text-sm mb-4 leading-relaxed">
            All 3 keys are required before deploying a server. You also need to add{" "}
            <code className="text-amber-400/80 bg-amber-400/5 px-1 py-0.5 rounded text-xs">tag:sshcode</code>{" "}
            to your{" "}
            <a href="https://login.tailscale.com/admin/acls" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline underline-offset-2 hover:text-amber-300">Tailscale ACL</a>.
          </p>
          <div className="text-left mb-6 space-y-1.5">
            {missing.map((key) => (
              <div key={key} className="flex items-center gap-2 font-mono text-xs text-amber-400/80">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                {key}
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 font-mono text-xs text-terminal border border-terminal/20 bg-terminal/5 px-5 py-2.5 rounded hover:bg-terminal/10 transition-all"
          >
            Go to Settings
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="font-mono text-[10px] text-terminal/50 tracking-widest uppercase mb-2">// deploy</p>
        <h1 className="text-2xl font-sans font-bold text-foreground">New Server</h1>
      </div>

      <div className="space-y-8">
        {/* Region */}
        <fieldset>
          <legend className="font-mono text-[11px] text-muted tracking-wide uppercase mb-3">Region</legend>
          <div className="grid grid-cols-3 gap-3">
            {regions.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  const newRegion = r.value;
                  const sizes = serverSizes(newRegion);
                  setForm({ ...form, region: newRegion, serverType: sizes[0].value });
                }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  form.region === r.value
                    ? "border-terminal/40 bg-terminal/5 shadow-[inset_0_1px_0_rgba(61,255,162,0.1)]"
                    : "border-border-subtle bg-surface hover:border-terminal/20"
                }`}
              >
                <p className={`font-mono text-xs ${form.region === r.value ? "text-terminal" : "text-foreground"}`}>
                  {r.label}
                </p>
                <p className="font-mono text-[10px] text-muted mt-1">{r.sub}</p>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Server size */}
        <fieldset>
          <legend className="font-mono text-[11px] text-muted tracking-wide uppercase mb-3">Server Size</legend>
          <div className="grid grid-cols-2 gap-3">
            {serverSizes(form.region).map((s) => (
              <button
                key={s.value}
                onClick={() => setForm({ ...form, serverType: s.value })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  form.serverType === s.value
                    ? "border-terminal/40 bg-terminal/5 shadow-[inset_0_1px_0_rgba(61,255,162,0.1)]"
                    : "border-border-subtle bg-surface hover:border-terminal/20"
                }`}
              >
                <div className="flex justify-between items-start">
                  <p className={`font-mono text-xs ${form.serverType === s.value ? "text-terminal" : "text-foreground"}`}>
                    {s.label}
                  </p>
                  <span className="font-mono text-[10px] text-muted">{s.price}</span>
                </div>
                <p className="font-mono text-[10px] text-muted mt-1">{s.specs}</p>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Agents */}
        <fieldset>
          <legend className="font-mono text-[11px] text-muted tracking-wide uppercase mb-3">AI Agents</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "opencode", label: "OpenCode", desc: "Web IDE" },
              { value: "claude-code", label: "Claude Code", desc: "Terminal via ttyd" },
            ].map((a) => {
              const selected = form.agents.includes(a.value as any);
              return (
                <button
                  key={a.value}
                  onClick={() => {
                    const agents = selected
                      ? form.agents.filter((x) => x !== a.value)
                      : [...form.agents, a.value as any];
                    if (agents.length > 0) setForm({ ...form, agents });
                  }}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selected
                      ? "border-terminal/40 bg-terminal/5 shadow-[inset_0_1px_0_rgba(61,255,162,0.1)]"
                      : "border-border-subtle bg-surface hover:border-terminal/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                      selected ? "border-terminal bg-terminal" : "border-muted/30"
                    }`}>
                      {selected && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-background"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                    <span className={`font-mono text-xs ${selected ? "text-terminal" : "text-foreground"}`}>
                      {a.label}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted mt-2 ml-5">{a.desc}</p>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-terminal text-background font-mono text-sm font-semibold py-3.5 rounded hover:shadow-[0_0_30px_rgba(61,255,162,0.2)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              Deploy Server
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
