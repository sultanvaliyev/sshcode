import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { decrypt } from "./lib/encryption";

/** Try to decrypt; if it fails, the value is legacy plaintext — return as-is. */
function tryDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const servers = await ctx.db
      .query("servers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Strip sensitive fields from list response (password not needed in list view)
    return servers.map(({ serverPassword, ...rest }) => rest);
  },
});

export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const server = await ctx.db.get(serverId);
    if (!server) return null;

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || server.userId !== user._id) return null;

    // Decrypt password for authorized owner display
    const { serverPassword, ...rest } = server;
    return {
      ...rest,
      serverPassword: tryDecrypt(serverPassword),
    };
  },
});

export const getLogs = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify ownership
    const server = await ctx.db.get(serverId);
    if (!server) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || server.userId !== user._id) return [];

    return await ctx.db
      .query("provisioningLogs")
      .withIndex("by_serverId", (q) => q.eq("serverId", serverId))
      .collect();
  },
});

// ── Internal mutations (only callable from other Convex functions) ──

export const updateStatus = internalMutation({
  args: {
    serverId: v.id("servers"),
    status: v.union(
      v.literal("provisioning"),
      v.literal("installing"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("deleting")
    ),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serverId, {
      status: args.status,
      statusMessage: args.statusMessage,
    });
  },
});

export const addLog = internalMutation({
  args: {
    serverId: v.id("servers"),
    step: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("error")
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("provisioningLogs", {
      serverId: args.serverId,
      step: args.step,
      status: args.status,
      message: args.message,
      timestamp: Date.now(),
    });
  },
});

export const createInternal = internalMutation({
  args: {
    userId: v.id("users"),
    region: v.string(),
    serverType: v.string(),
    agents: v.array(v.union(v.literal("opencode"), v.literal("claude-code"), v.literal("codex"))),
    serverPassword: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("servers", {
      userId: args.userId,
      hetznerServerId: "",
      hetznerIp: "",
      region: args.region,
      serverType: args.serverType,
      agents: args.agents,
      serverUsername: "sshcode",
      serverPassword: args.serverPassword,
      opencodePort: 4096,
      claudeCodePort: 4097,
      status: "provisioning",
      statusMessage: "Starting provisioning...",
      createdAt: Date.now(),
    });
  },
});

export const patchServer = internalMutation({
  args: {
    serverId: v.id("servers"),
    hetznerServerId: v.optional(v.string()),
    hetznerIp: v.optional(v.string()),
    tailscaleName: v.optional(v.string()),
    tailscaleDomain: v.optional(v.string()),
    tailscaleIp: v.optional(v.string()),
    agents: v.optional(v.array(v.union(v.literal("opencode"), v.literal("claude-code"), v.literal("codex")))),
    serverUsername: v.optional(v.string()),
    serverPassword: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("provisioning"),
      v.literal("installing"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("deleting")
    )),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { serverId, ...fields } = args;
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) patch[k] = v;
    }
    await ctx.db.patch(serverId, patch);
  },
});

export const updateHealth = internalMutation({
  args: {
    serverId: v.id("servers"),
    healthStatus: v.union(
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("unreachable")
    ),
    lastHealthCheck: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serverId, {
      healthStatus: args.healthStatus,
      lastHealthCheck: args.lastHealthCheck,
    });
  },
});

export const remove = internalMutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    // Delete logs first
    const logs = await ctx.db
      .query("provisioningLogs")
      .withIndex("by_serverId", (q) => q.eq("serverId", serverId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    await ctx.db.delete(serverId);
  },
});
