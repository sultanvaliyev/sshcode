import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

    return await ctx.db
      .query("servers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
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

    return server;
  },
});

export const getLogs = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    return await ctx.db
      .query("provisioningLogs")
      .withIndex("by_serverId", (q) => q.eq("serverId", serverId))
      .collect();
  },
});

export const updateStatus = mutation({
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

export const addLog = mutation({
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

export const createInternal = mutation({
  args: {
    userId: v.id("users"),
    region: v.string(),
    serverType: v.string(),
    agents: v.array(v.union(v.literal("opencode"), v.literal("claude-code"))),
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

export const patchServer = mutation({
  args: {
    serverId: v.id("servers"),
    hetznerServerId: v.optional(v.string()),
    hetznerIp: v.optional(v.string()),
    tailscaleName: v.optional(v.string()),
    tailscaleDomain: v.optional(v.string()),
    tailscaleIp: v.optional(v.string()),
    agents: v.optional(v.array(v.union(v.literal("opencode"), v.literal("claude-code")))),
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

export const updateHealth = mutation({
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

export const remove = mutation({
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
