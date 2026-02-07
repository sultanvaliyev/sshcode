import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background grid-bg relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-terminal/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-200px] w-[400px] h-[400px] rounded-full bg-terminal/3 blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex justify-between items-center animate-float-up">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-terminal shadow-[0_0_8px_rgba(61,255,162,0.6)]" />
          <span className="font-mono font-semibold text-sm tracking-wider text-foreground">SSHCode</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/sign-in"
            className="font-mono text-xs tracking-wide text-muted hover:text-foreground transition-colors"
          >
            sign_in
          </Link>
          <Link
            href="/sign-up"
            className="font-mono text-xs tracking-wide bg-terminal/10 text-terminal border border-terminal/20 px-4 py-2 rounded hover:bg-terminal/20 transition-all"
          >
            get_started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-32">
        <div className="animate-float-up animate-float-up-1">
          <p className="font-mono text-xs text-terminal/70 tracking-widest uppercase mb-6">
            $ ssh deploy --cloud
          </p>
        </div>

        <h1 className="text-5xl md:text-7xl font-sans font-800 leading-[0.95] tracking-tight mb-8 animate-float-up animate-float-up-2">
          <span className="text-foreground">Your AI dev</span>
          <br />
          <span className="text-foreground">environment.</span>
          <br />
          <span className="text-terminal">One command.</span>
        </h1>

        <p className="text-lg md:text-xl text-muted max-w-xl leading-relaxed mb-12 font-light animate-float-up animate-float-up-3">
          Provision persistent OpenCode & Claude Code servers on Hetzner.
          Access from any device through Tailscale. Your infrastructure, your keys.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-float-up animate-float-up-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 bg-terminal text-background font-mono text-sm font-semibold px-8 py-3.5 rounded hover:shadow-[0_0_30px_rgba(61,255,162,0.3)] transition-all"
          >
            <span>Deploy Now</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 border border-border-subtle text-muted font-mono text-sm px-8 py-3.5 rounded hover:border-terminal/30 hover:text-foreground transition-all"
          >
            View Dashboard
          </Link>
        </div>

        {/* Terminal preview */}
        <div className="mt-24 animate-float-up animate-float-up-5">
          <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden shadow-2xl shadow-black/50">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="font-mono text-[10px] text-muted ml-2">sshcode-a7f3k2 ~ </span>
            </div>
            {/* Terminal content */}
            <div className="p-6 font-mono text-sm leading-7">
              <p><span className="text-terminal">$</span> <span className="text-muted">sshcode deploy --region ash --agents opencode,claude-code</span></p>
              <p className="text-terminal/60">Creating Tailscale auth key... <span className="text-terminal">done</span></p>
              <p className="text-terminal/60">Provisioning cx22 in Ashburn, VA... <span className="text-terminal">done</span></p>
              <p className="text-terminal/60">Installing OpenCode & Claude Code... <span className="text-terminal">done</span></p>
              <p className="mt-2"><span className="text-terminal">&#10003;</span> <span className="text-foreground">Server ready at</span> <span className="text-terminal">sshcode-a7f3k2.tailnet.ts.net:4096</span></p>
              <p className="text-muted mt-1 terminal-cursor">_</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid md:grid-cols-3 gap-px bg-border-subtle rounded-lg overflow-hidden">
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
              ),
              title: "One-Click Deploy",
              desc: "From zero to running AI coding server in under 3 minutes. Automated provisioning via cloud-init."
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              ),
              title: "Private & Encrypted",
              desc: "Tailscale VPN mesh. No ports exposed. Your API keys never leave your server."
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
              ),
              title: "Access Anywhere",
              desc: "Phone, tablet, laptop. Same environment, always in sync via Tailscale network."
            },
          ].map((f, i) => (
            <div key={i} className="bg-surface p-8 group">
              <div className="text-terminal/60 group-hover:text-terminal transition-colors mb-4">
                {f.icon}
              </div>
              <h3 className="font-sans font-semibold text-foreground mb-2 text-sm">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed font-light">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-32">
          <p className="font-mono text-xs text-terminal/50 tracking-widest uppercase mb-8">// how it works</p>
          <div className="space-y-0">
            {[
              { step: "01", title: "Connect your accounts", desc: "Add Hetzner and Tailscale API keys in settings" },
              { step: "02", title: "Configure your server", desc: "Pick region, size, and which AI agents to install" },
              { step: "03", title: "Deploy automatically", desc: "We provision, install, and configure everything" },
              { step: "04", title: "Code from anywhere", desc: "Access via Tailscale from any device on your network" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-8 py-6 border-b border-border-subtle group">
                <span className="font-mono text-xs text-terminal/40 group-hover:text-terminal transition-colors pt-1 shrink-0">{s.step}</span>
                <div>
                  <p className="font-sans font-medium text-foreground mb-1">{s.title}</p>
                  <p className="text-muted text-sm font-light">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-32 text-center">
          <p className="font-mono text-sm text-muted mb-6">Ready to deploy?</p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-terminal text-background font-mono text-sm font-semibold px-10 py-4 rounded hover:shadow-[0_0_40px_rgba(61,255,162,0.25)] transition-all"
          >
            Launch Your First Server
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-32 pt-8 border-t border-border-subtle flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal/50" />
            <span className="font-mono text-xs text-muted">SSHCode</span>
          </div>
          <p className="font-mono text-[10px] text-muted/50">Your infrastructure. Your keys. Your code.</p>
        </footer>
      </main>
    </div>
  );
}
