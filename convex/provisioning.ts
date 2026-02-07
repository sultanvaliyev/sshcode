import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { decrypt, encrypt } from "./lib/encryption";

// ──────────────────────────────────────────────
// MAIN PROVISIONING ACTION
// ──────────────────────────────────────────────

export const provisionServer = action({
  args: {
    region: v.union(v.literal("ash"), v.literal("hil"), v.literal("nbg1"), v.literal("fsn1"), v.literal("hel1")),
    serverType: v.union(v.literal("cx23"), v.literal("cx33"), v.literal("cpx21"), v.literal("cpx31")),
    agents: v.array(v.union(v.literal("opencode"), v.literal("claude-code"), v.literal("codex"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 1. Get user and their API keys (encrypted at rest)
    const user = await ctx.runQuery(api.users.getCurrent);
    if (!user) throw new Error("User not found");
    if (!user.hetznerApiKey) throw new Error("Hetzner API key required");
    if (!user.tailscaleApiKey) throw new Error("Tailscale API key required");
    if (!user.tailscaleTailnet) throw new Error("Tailscale Tailnet ID required");

    const hetznerApiKey = decrypt(user.hetznerApiKey);
    const tailscaleApiKey = decrypt(user.tailscaleApiKey);

    const serverPassword = generatePassword(24);
    const serverName = `sshcode-${generateId(8)}`;

    // 2. Create server record (password encrypted at rest)
    const serverId = await ctx.runMutation(internal.servers.createInternal, {
      userId: user._id,
      region: args.region,
      serverType: args.serverType,
      agents: args.agents,
      serverPassword: encrypt(serverPassword),
    });

    // ── Step 1: Create Tailscale auth key ──
    await logStep(ctx, serverId, "tailscale_auth_key", "running");
    let tailscaleAuthKey: string;
    let tailscaleDomain: string;
    try {
      tailscaleAuthKey = await createTailscaleAuthKey(
        tailscaleApiKey,
        user.tailscaleTailnet || "-",
        serverName
      );
      tailscaleDomain = await getTailscaleDnsSuffix(
        tailscaleApiKey,
        user.tailscaleTailnet || "-"
      );
      await logStep(ctx, serverId, "tailscale_auth_key", "success");
    } catch (e: any) {
      await logStep(ctx, serverId, "tailscale_auth_key", "error", e.message);
      await ctx.runMutation(internal.servers.updateStatus, {
        serverId,
        status: "error",
        statusMessage: "Failed to create Tailscale auth key",
      });
      return;
    }

    // ── Step 2: Create Hetzner server ──
    await logStep(ctx, serverId, "hetzner_create", "running");
    let hetznerServer: { id: string; ip: string };
    try {
      const setupScript = generateSetupScript({
        serverName,
        tailscaleAuthKey,
        agents: args.agents,
        serverPassword,
        opencodePort: 4096,
        claudeCodePort: 4097,
        codexPort: 4100,
      });

      hetznerServer = await createHetznerServer(
        hetznerApiKey,
        serverName,
        args.serverType,
        args.region,
        setupScript
      );
      await logStep(ctx, serverId, "hetzner_create", "success",
        `Server ID: ${hetznerServer.id}`);
    } catch (e: any) {
      await logStep(ctx, serverId, "hetzner_create", "error", e.message);
      await ctx.runMutation(internal.servers.updateStatus, {
        serverId,
        status: "error",
        statusMessage: "Failed to create Hetzner server",
      });
      return;
    }

    // ── Step 3: Update server record with IPs ──
    await ctx.runMutation(internal.servers.patchServer, {
      serverId,
      hetznerServerId: String(hetznerServer.id),
      hetznerIp: hetznerServer.ip,
      tailscaleName: serverName,
      tailscaleDomain,
      status: "installing",
      statusMessage: "Server created, installing software...",
    });
    await logStep(ctx, serverId, "software_install", "running",
      "Cloud-init running setup script on server...");

    // ── Step 4: Poll until setup completes ──
    // Schedule a follow-up action to check if setup is done
    await ctx.scheduler.runAfter(30_000, internal.provisioning.pollSetupStatus, {
      serverId,
      hetznerIp: hetznerServer.ip,
      attempt: 1,
    });
  },
});


// ──────────────────────────────────────────────
// POLL SETUP COMPLETION
// ──────────────────────────────────────────────

export const pollSetupStatus = internalAction({
  args: {
    serverId: v.id("servers"),
    hetznerIp: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const MAX_ATTEMPTS = 40; // 20 minutes max

    try {
      // Check if setup is complete by reaching the management API (port 4098)
      const response = await fetch(
        `http://${args.hetznerIp}:4098/status`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (response.ok || response.status === 401) {
        await logStep(ctx, args.serverId, "software_install", "success");
        await ctx.runMutation(internal.servers.updateStatus, {
          serverId: args.serverId,
          status: "running",
          statusMessage: "Server is ready",
        });
        return;
      }
    } catch {
      // Server not ready yet
    }

    if (args.attempt >= MAX_ATTEMPTS) {
      await logStep(ctx, args.serverId, "software_install", "error",
        "Timed out waiting for setup to complete");
      await ctx.runMutation(internal.servers.updateStatus, {
        serverId: args.serverId,
        status: "error",
        statusMessage: "Setup timed out after 20 minutes",
      });
      return;
    }

    // Retry in 30 seconds
    await ctx.scheduler.runAfter(30_000, internal.provisioning.pollSetupStatus, {
      ...args,
      attempt: args.attempt + 1,
    });
  },
});


// ──────────────────────────────────────────────
// INSTALL / UNINSTALL AGENT ON RUNNING SERVER
// ──────────────────────────────────────────────

export const installAgent = action({
  args: {
    serverId: v.id("servers"),
    agent: v.union(v.literal("opencode"), v.literal("claude-code"), v.literal("codex")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const server = await ctx.runQuery(api.servers.get, { serverId: args.serverId });
    if (!server) throw new Error("Server not found");
    if (server.status !== "running") throw new Error("Server must be running to install agents");
    if (server.agents.includes(args.agent)) throw new Error(`${args.agent} is already installed`);

    // server.serverPassword is already decrypted by the get query
    let response: Response;
    try {
      response = await fetch(`http://${server.hetznerIp}:4098/install`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${server.serverPassword}`,
        },
        body: JSON.stringify({ agent: args.agent }),
        signal: AbortSignal.timeout(120_000), // install can take a while
      });
    } catch {
      throw new Error(
        "Management API unreachable on this server. " +
        "This server was provisioned before agent management was available. " +
        "Delete and recreate the server to enable one-click agent installs."
      );
    }

    if (!response.ok) {
      const text = await response.text();
      let errorMsg: string;
      try { errorMsg = JSON.parse(text).error; } catch { errorMsg = text; }
      throw new Error(`Install failed: ${errorMsg || response.statusText}`);
    }

    await ctx.runMutation(internal.servers.patchServer, {
      serverId: args.serverId,
      agents: [...server.agents, args.agent],
    });
  },
});

export const uninstallAgent = action({
  args: {
    serverId: v.id("servers"),
    agent: v.union(v.literal("opencode"), v.literal("claude-code"), v.literal("codex")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const server = await ctx.runQuery(api.servers.get, { serverId: args.serverId });
    if (!server) throw new Error("Server not found");
    if (server.status !== "running") throw new Error("Server must be running to uninstall agents");
    if (!server.agents.includes(args.agent)) throw new Error(`${args.agent} is not installed`);

    // server.serverPassword is already decrypted by the get query
    let response: Response;
    try {
      response = await fetch(`http://${server.hetznerIp}:4098/uninstall`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${server.serverPassword}`,
        },
        body: JSON.stringify({ agent: args.agent }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(
        "Management API unreachable on this server. " +
        "This server was provisioned before agent management was available. " +
        "Delete and recreate the server to enable one-click agent installs."
      );
    }

    if (!response.ok) {
      const text = await response.text();
      let errorMsg: string;
      try { errorMsg = JSON.parse(text).error; } catch { errorMsg = text; }
      throw new Error(`Uninstall failed: ${errorMsg || response.statusText}`);
    }

    await ctx.runMutation(internal.servers.patchServer, {
      serverId: args.serverId,
      agents: server.agents.filter((a: string) => a !== args.agent),
    });
  },
});


// ──────────────────────────────────────────────
// RESET SERVER CREDENTIALS
// ──────────────────────────────────────────────

export const resetCredentials = action({
  args: {
    serverId: v.id("servers"),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (args.username.length < 1) throw new Error("Username is required");
    if (args.password.length < 8) throw new Error("Password must be at least 8 characters");
    if (!/^[a-zA-Z0-9_-]+$/.test(args.username)) throw new Error("Username can only contain letters, numbers, hyphens, and underscores");

    const server = await ctx.runQuery(api.servers.get, { serverId: args.serverId });
    if (!server) throw new Error("Server not found");
    if (server.status !== "running") throw new Error("Server must be running to reset credentials");

    // server.serverPassword is already decrypted by the get query
    // Call management API with the OLD password (still active)
    let response: Response;
    try {
      response = await fetch(`http://${server.hetznerIp}:4098/reset-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${server.serverPassword}`,
        },
        body: JSON.stringify({ username: args.username, password: args.password }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error(
        "Management API unreachable on this server. " +
        "This server was provisioned before credential reset was available. " +
        "Delete and recreate the server to enable this feature."
      );
    }

    if (!response.ok) {
      const text = await response.text();
      let errorMsg: string;
      try { errorMsg = JSON.parse(text).error; } catch { errorMsg = text; }
      throw new Error(`Reset failed: ${errorMsg || response.statusText}`);
    }

    // Update the DB record with new credentials (encrypted at rest)
    await ctx.runMutation(internal.servers.patchServer, {
      serverId: args.serverId,
      serverUsername: args.username,
      serverPassword: encrypt(args.password),
    });
  },
});


// ──────────────────────────────────────────────
// DELETE SERVER
// ──────────────────────────────────────────────

export const deleteServer = action({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.getCurrent);
    const server = await ctx.runQuery(api.servers.get, {
      serverId: args.serverId,
    });
    if (!user || !server) throw new Error("Not found");

    await ctx.runMutation(internal.servers.updateStatus, {
      serverId: args.serverId,
      status: "deleting",
    });

    // Delete from Hetzner
    if (user.hetznerApiKey && server.hetznerServerId) {
      const hetznerKey = decrypt(user.hetznerApiKey);
      await fetch(
        `https://api.hetzner.cloud/v1/servers/${server.hetznerServerId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${hetznerKey}` },
        }
      );
    }

    // Remove from Tailscale (optional - device will go stale)
    // You can use Tailscale API to delete the device

    // Delete the DB record
    await ctx.runMutation(internal.servers.remove, {
      serverId: args.serverId,
    });
  },
});


// ──────────────────────────────────────────────
// HELPER: Hetzner API
// ──────────────────────────────────────────────

async function createHetznerServer(
  apiKey: string,
  name: string,
  serverType: string,
  region: string,
  setupScript: string
): Promise<{ id: string; ip: string }> {
  const locationMap: Record<string, string> = {
    ash: "ash",    // Ashburn, VA
    hil: "hil",    // Hillsboro, OR
    nbg1: "nbg1",  // Nuremberg, DE
    fsn1: "fsn1",  // Falkenstein, DE
    hel1: "hel1",  // Helsinki, FI
  };

  const response = await fetch("https://api.hetzner.cloud/v1/servers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      server_type: serverType,
      location: locationMap[region],
      image: "ubuntu-24.04",
      user_data: setupScript,  // cloud-init script
      start_after_create: true,
      public_net: {
        enable_ipv4: true,
        enable_ipv6: true,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Hetzner API error:", err.error?.message || response.statusText);
    throw new Error("Failed to create server — check your Hetzner API key and permissions");
  }

  const data = await response.json();
  return {
    id: String(data.server.id),
    ip: data.server.public_net.ipv4.ip,
  };
}


// ──────────────────────────────────────────────
// HELPER: Tailscale API
// ──────────────────────────────────────────────

async function getTailscaleDnsSuffix(
  apiKey: string,
  tailnet: string
): Promise<string> {
  // Try to get the MagicDNS suffix from an existing device on the tailnet
  const response = await fetch(
    `https://api.tailscale.com/api/v2/tailnet/${tailnet}/devices?fields=default`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      },
    }
  );

  if (response.ok) {
    const data = await response.json();
    // Extract domain from a device's name, e.g. "myhost.taila43c9d.ts.net"
    const devices = data.devices || [];
    for (const device of devices) {
      const name: string = device.name || "";
      // MagicDNS names look like "hostname.tailnet-name.ts.net"
      const match = name.match(/^[^.]+\.(.+\.ts\.net)\.?$/);
      if (match) {
        return match[1];
      }
    }
  }

  return "tailnet.ts.net";
}

async function createTailscaleAuthKey(
  apiKey: string,
  tailnet: string,
  description: string
): Promise<string> {
  const response = await fetch(
    `https://api.tailscale.com/api/v2/tailnet/${tailnet}/keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capabilities: {
          devices: {
            create: {
              reusable: false,
              ephemeral: false,
              preauthorized: true,
              tags: ["tag:sshcode"],
            },
          },
        },
        expirySeconds: 3600, // 1 hour to use the key
        description,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    console.error("Tailscale API error:", err.message || response.statusText);
    throw new Error("Failed to create Tailscale auth key — check your API key and tailnet permissions");
  }

  const data = await response.json();
  return data.key;
}


// ──────────────────────────────────────────────
// HELPER: Setup Script Generator
// ──────────────────────────────────────────────

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function toBase64(s: string): string {
  // Works in both Node.js and Convex runtime
  return btoa(unescape(encodeURIComponent(s)));
}

function generateSetupScript(config: {
  serverName: string;
  tailscaleAuthKey: string;
  agents: string[];
  serverPassword: string;
  opencodePort: number;
  claudeCodePort: number;
  codexPort: number;
}): string {
  // Build .env content safely, then base64-encode for injection
  const envLines: string[] = [
    `OPENCODE_SERVER_USERNAME=sshcode`,
    `OPENCODE_SERVER_PASSWORD=${config.serverPassword}`,
  ];

  const envFileB64 = toBase64(envLines.join("\n") + "\n");

  const installOpenCode = config.agents.includes("opencode");
  const installClaudeCode = config.agents.includes("claude-code");
  const installCodex = config.agents.includes("codex");

  return `#!/bin/bash
set -euo pipefail
exec > /var/log/sshcode-setup.log 2>&1

echo "=== SSHCode Setup Starting ==="

# ── System updates ──
apt-get update
apt-get install -y curl wget git jq unzip

# ── Install Tailscale ──
curl -fsSL https://tailscale.com/install.sh | sh
systemctl enable --now tailscaled
tailscale up --authkey=${shellEscape(config.tailscaleAuthKey)} --hostname=${shellEscape(config.serverName)}

# ── Create sshcode user with limited sudo ──
useradd -m -s /bin/bash sshcode
usermod -aG sudo sshcode
cat > /etc/sudoers.d/sshcode <<'SUDOEOF'
sshcode ALL=(ALL) NOPASSWD: /bin/systemctl restart sshcode-mgmt.service, /bin/systemctl daemon-reload
SUDOEOF
chmod 440 /etc/sudoers.d/sshcode
mkdir -p /home/sshcode/.config/systemd/user
loginctl enable-linger sshcode

# ── Write environment file (base64-decoded for safety) ──
echo ${shellEscape(envFileB64)} | base64 -d > /home/sshcode/.env
chown sshcode:sshcode /home/sshcode/.env
chmod 600 /home/sshcode/.env

# ── Install Node.js (required for management API + Claude Code) ──
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ── Install ttyd (web terminal) ──
wget -O /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.x86_64
chmod +x /usr/local/bin/ttyd

# ── Firewall: restrict management + service ports to Tailscale only ──
# Get the Tailscale interface (typically tailscale0)
TS_IFACE=$(ip -o link show | grep -oP 'tailscale\\d+' | head -1 || echo "tailscale0")
apt-get install -y iptables-persistent || true
# Allow on Tailscale interface
for PORT in 4096 4097 4099 4100; do
  iptables -A INPUT -i "\${TS_IFACE}" -p tcp --dport \${PORT} -j ACCEPT
  iptables -A INPUT -p tcp --dport \${PORT} -j DROP
done
# Save rules
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# ── Decode server password for ttyd service configs ──
SERVER_PASSWORD=$(grep '^OPENCODE_SERVER_PASSWORD=' /home/sshcode/.env | cut -d= -f2-)

# ── Web terminal (bash) on port 4099 ──
cat > /home/sshcode/.config/systemd/user/terminal.service <<TERMEOF
[Unit]
Description=Web Terminal (bash)
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/usr/local/bin/ttyd -W -p 4099 -c sshcode:\${SERVER_PASSWORD} bash
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
TERMEOF

chown -R sshcode:sshcode /home/sshcode/.config
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user daemon-reload"
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user enable --now terminal.service"

${installOpenCode ? `
# ── Install OpenCode ──
su - sshcode -c "curl -fsSL https://opencode.ai/install | bash"

# ── OpenCode systemd service ──
cat > /home/sshcode/.config/systemd/user/opencode.service <<'EOF'
[Unit]
Description=OpenCode Server
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/home/sshcode/.opencode/bin/opencode web --hostname 0.0.0.0 --port ${String(config.opencodePort)}
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

chown -R sshcode:sshcode /home/sshcode/.config
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user daemon-reload"
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user enable --now opencode.service"
` : ""}

${installClaudeCode ? `
# ── Install Claude Code ──
npm install -g @anthropic-ai/claude-code

# ── Claude Code via ttyd systemd service ──
cat > /home/sshcode/.config/systemd/user/claude-code.service <<CCEOF
[Unit]
Description=Claude Code via ttyd
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/usr/local/bin/ttyd -W -p ${String(config.claudeCodePort)} -c sshcode:\${SERVER_PASSWORD} claude
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
CCEOF

chown -R sshcode:sshcode /home/sshcode/.config
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user daemon-reload"
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user enable --now claude-code.service"
` : ""}

${installCodex ? `
# ── Install Codex CLI ──
npm install -g @openai/codex

# ── Codex CLI via ttyd systemd service ──
cat > /home/sshcode/.config/systemd/user/codex.service <<CXEOF
[Unit]
Description=Codex CLI via ttyd
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/usr/local/bin/ttyd -W -p ${String(config.codexPort)} -c sshcode:\${SERVER_PASSWORD} codex
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
CXEOF

chown -R sshcode:sshcode /home/sshcode/.config
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user daemon-reload"
su - sshcode -c "XDG_RUNTIME_DIR=/run/user/$(id -u sshcode) systemctl --user enable --now codex.service"
` : ""}

# ── Management API ──
cat > /home/sshcode/management-api.js <<'MGMTEOF'
const http = require("http");
const { execSync, exec } = require("child_process");

const PORT = 4098;
const TOKEN = process.env.OPENCODE_SERVER_PASSWORD;
const SSHCODE_UID = String(execSync("id -u sshcode").toString().trim());

function systemctlUser(cmd) {
  return \`su - sshcode -c "XDG_RUNTIME_DIR=/run/user/\${SSHCODE_UID} systemctl --user \${cmd}"\`;
}

function isInstalled(agent) {
  try {
    if (agent === "opencode") {
      execSync("test -f /home/sshcode/.opencode/bin/opencode");
      return true;
    }
    if (agent === "claude-code") {
      execSync("which claude 2>/dev/null");
      return true;
    }
    if (agent === "codex") {
      execSync("which codex 2>/dev/null");
      return true;
    }
  } catch { return false; }
  return false;
}

function isRunning(agent) {
  const svcMap = { "opencode": "opencode.service", "claude-code": "claude-code.service", "codex": "codex.service" };
  const svc = svcMap[agent] || "unknown.service";
  try {
    const out = execSync(systemctlUser(\`is-active \${svc}\`)).toString().trim();
    return out === "active";
  } catch { return false; }
}

function installAgent(agent, res) {
  const serverPassword = TOKEN;
  if (agent === "opencode") {
    exec(\`
      su - sshcode -c "curl -fsSL https://opencode.ai/install | bash" && \\
      cat > /home/sshcode/.config/systemd/user/opencode.service <<'EOF'
[Unit]
Description=OpenCode Server
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/home/sshcode/.opencode/bin/opencode web --hostname 0.0.0.0 --port 4096
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
      chown -R sshcode:sshcode /home/sshcode/.config && \\
      \${systemctlUser("daemon-reload")} && \\
      \${systemctlUser("enable --now opencode.service")}
    \`.trim(), (err) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
      else { res.writeHead(200); res.end(JSON.stringify({ ok: true, agent: "opencode" })); }
    });
  } else if (agent === "claude-code") {
    exec(\`
      npm install -g @anthropic-ai/claude-code && \\
      cat > /home/sshcode/.config/systemd/user/claude-code.service <<EOF
[Unit]
Description=Claude Code via ttyd
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/usr/local/bin/ttyd -W -p 4097 -c sshcode:\${serverPassword} claude
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
      chown -R sshcode:sshcode /home/sshcode/.config && \\
      \${systemctlUser("daemon-reload")} && \\
      \${systemctlUser("enable --now claude-code.service")}
    \`.trim(), (err) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
      else { res.writeHead(200); res.end(JSON.stringify({ ok: true, agent: "claude-code" })); }
    });
  } else if (agent === "codex") {
    exec(\`
      npm install -g @openai/codex && \\
      cat > /home/sshcode/.config/systemd/user/codex.service <<EOF
[Unit]
Description=Codex CLI via ttyd
After=network.target tailscaled.service

[Service]
Type=simple
EnvironmentFile=/home/sshcode/.env
ExecStart=/usr/local/bin/ttyd -W -p 4100 -c sshcode:\${serverPassword} codex
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
      chown -R sshcode:sshcode /home/sshcode/.config && \\
      \${systemctlUser("daemon-reload")} && \\
      \${systemctlUser("enable --now codex.service")}
    \`.trim(), (err) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
      else { res.writeHead(200); res.end(JSON.stringify({ ok: true, agent: "codex" })); }
    });
  } else {
    res.writeHead(400); res.end(JSON.stringify({ error: "unknown agent" }));
  }
}

function resetCredentials(username, password, res) {
  const fs = require("fs");

  // Input validation (defense in depth — Convex side also validates)
  if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length > 64) {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: "Invalid username format" }));
  }
  if (password.length < 8 || password.length > 256) {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: "Password must be 8-256 characters" }));
  }
  // Reject characters that could break service file syntax
  if (/[\\n\\r\\0]/.test(password)) {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: "Password contains invalid characters" }));
  }

  try {
    // Update .env with new credentials
    let env = fs.readFileSync("/home/sshcode/.env", "utf8");
    env = env.replace(/^OPENCODE_SERVER_USERNAME=.*$/m, "OPENCODE_SERVER_USERNAME=" + username);
    env = env.replace(/^OPENCODE_SERVER_PASSWORD=.*$/m, "OPENCODE_SERVER_PASSWORD=" + password);
    fs.writeFileSync("/home/sshcode/.env", env);

    // Update ttyd service files with new credentials
    const ttydServices = [
      "/home/sshcode/.config/systemd/user/claude-code.service",
      "/home/sshcode/.config/systemd/user/codex.service",
      "/home/sshcode/.config/systemd/user/terminal.service",
    ];
    for (const svcPath of ttydServices) {
      if (fs.existsSync(svcPath)) {
        let svc = fs.readFileSync(svcPath, "utf8");
        svc = svc.replace(/-c [^:]+:[^ ]+/, "-c " + username + ":" + password);
        fs.writeFileSync(svcPath, svc);
      }
    }

    // Reload and restart services
    execSync(systemctlUser("daemon-reload"));
    try { execSync(systemctlUser("restart claude-code.service")); } catch {}
    try { execSync(systemctlUser("restart codex.service")); } catch {}
    try { execSync(systemctlUser("restart terminal.service")); } catch {}
    try { execSync(systemctlUser("restart opencode.service")); } catch {}

    // Schedule self-restart after responding so new TOKEN takes effect
    setTimeout(() => {
      try { execSync("sudo systemctl restart sshcode-mgmt.service"); } catch {}
    }, 1000);

    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Credential reset failed" }));
  }
}

function uninstallAgent(agent, res) {
  const svcMap = { "opencode": "opencode.service", "claude-code": "claude-code.service", "codex": "codex.service" };
  const svc = svcMap[agent] || "unknown.service";
  exec(\`
    \${systemctlUser(\`stop \${svc}\`)} ; \\
    \${systemctlUser(\`disable \${svc}\`)}
  \`.trim(), (err) => {
    if (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
    else { res.writeHead(200); res.end(JSON.stringify({ ok: true, agent })); }
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const auth = req.headers.authorization || "";
  if (auth !== \`Bearer \${TOKEN}\`) { res.writeHead(401); return res.end(JSON.stringify({ error: "unauthorized" })); }

  if (req.method === "GET" && req.url === "/status") {
    const agents = {};
    for (const a of ["opencode", "claude-code", "codex"]) {
      agents[a] = { installed: isInstalled(a), running: isRunning(a) };
    }
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, agents }));
  }

  if (req.method === "POST" && req.url === "/install") {
    const body = await readBody(req);
    if (!body.agent || !["opencode", "claude-code", "codex"].includes(body.agent)) {
      res.writeHead(400); return res.end(JSON.stringify({ error: "agent must be 'opencode', 'claude-code', or 'codex'" }));
    }
    return installAgent(body.agent, res);
  }

  if (req.method === "POST" && req.url === "/uninstall") {
    const body = await readBody(req);
    if (!body.agent || !["opencode", "claude-code", "codex"].includes(body.agent)) {
      res.writeHead(400); return res.end(JSON.stringify({ error: "agent must be 'opencode', 'claude-code', or 'codex'" }));
    }
    return uninstallAgent(body.agent, res);
  }

  if (req.method === "POST" && req.url === "/reset-credentials") {
    const body = await readBody(req);
    if (!body.username || typeof body.username !== "string" || !body.password || typeof body.password !== "string") {
      res.writeHead(400); return res.end(JSON.stringify({ error: "username and password required" }));
    }
    return resetCredentials(body.username, body.password, res);
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", () => console.log(\`Management API listening on :\${PORT}\`));
MGMTEOF
chown sshcode:sshcode /home/sshcode/management-api.js

# ── Management API systemd service (runs as sshcode user) ──
cat > /etc/systemd/system/sshcode-mgmt.service <<'EOF'
[Unit]
Description=SSHCode Management API
After=network.target

[Service]
Type=simple
User=sshcode
Group=sshcode
EnvironmentFile=/home/sshcode/.env
ExecStart=/usr/bin/node /home/sshcode/management-api.js
WorkingDirectory=/home/sshcode
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now sshcode-mgmt.service

# ── Signal completion ──
touch /tmp/sshcode-ready
echo "=== SSHCode Setup Complete ==="
`;
}


// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function generatePassword(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomBytes[i] % chars.length);
  }
  return result;
}

function generateId(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomBytes[i] % chars.length);
  }
  return result;
}

async function logStep(
  ctx: any,
  serverId: any,
  step: string,
  status: "pending" | "running" | "success" | "error",
  message?: string
) {
  await ctx.runMutation(internal.servers.addLog, {
    serverId,
    step,
    status,
    message,
  });
}
