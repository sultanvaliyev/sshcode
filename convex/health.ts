import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { decrypt } from "./lib/encryption";

function tryDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export const getRunningServers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("servers")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
  },
});

export const checkAllServers = internalAction({
  args: {},
  handler: async (ctx) => {
    const servers = await ctx.runQuery(internal.health.getRunningServers);

    for (const server of servers) {
      if (!server.hetznerIp) {
        await ctx.runMutation(internal.servers.updateHealth, {
          serverId: server._id,
          healthStatus: "unreachable",
          lastHealthCheck: Date.now(),
        });
        continue;
      }

      let mgmtReachable = false;

      // Primary check: management API on port 4098
      try {
        const serverPassword = tryDecrypt(server.serverPassword);
        const res = await fetch(
          `http://${server.hetznerIp}:4098/status`,
          {
            headers: { Authorization: `Bearer ${serverPassword}` },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (res.ok) mgmtReachable = true;
      } catch {
        // Management API not reachable
      }

      if (mgmtReachable) {
        await ctx.runMutation(internal.servers.updateHealth, {
          serverId: server._id,
          healthStatus: "healthy",
          lastHealthCheck: Date.now(),
        });
        continue;
      }

      // Fallback: check agent ports directly
      let agentReachable = false;
      const ports: number[] = [];
      if (server.agents.includes("opencode")) ports.push(server.opencodePort || 4096);
      if (server.agents.includes("claude-code")) ports.push(server.claudeCodePort || 4097);

      for (const port of ports) {
        if (agentReachable) break;
        try {
          await fetch(
            `http://${server.hetznerIp}:${port}`,
            { signal: AbortSignal.timeout(5000) }
          );
          agentReachable = true;
        } catch {
          // Port not reachable
        }
      }

      await ctx.runMutation(internal.servers.updateHealth, {
        serverId: server._id,
        healthStatus: agentReachable ? "degraded" : "unreachable",
        lastHealthCheck: Date.now(),
      });
    }
  },
});
