import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { encrypt } from "./lib/encryption";

export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email!,
      name: identity.name,
      plan: "free",
      createdAt: Date.now(),
    });
  },
});

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

export const updateKeys = mutation({
  args: {
    hetznerApiKey: v.optional(v.string()),
    tailscaleApiKey: v.optional(v.string()),
    tailscaleTailnet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    // Auto-create user if they don't exist yet (race with EnsureUser)
    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email!,
        name: identity.name,
        plan: "free",
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
      if (!user) throw new Error("Failed to create user");
    }

    // Save each key independently — empty string clears the field
    // Sensitive keys are encrypted at rest with ENCRYPTION_KEY
    const patch: Record<string, string | undefined> = {};
    if (args.hetznerApiKey !== undefined) {
      patch.hetznerApiKey = args.hetznerApiKey
        ? encrypt(args.hetznerApiKey)
        : undefined;
    }
    if (args.tailscaleApiKey !== undefined) {
      patch.tailscaleApiKey = args.tailscaleApiKey
        ? encrypt(args.tailscaleApiKey)
        : undefined;
    }
    if (args.tailscaleTailnet !== undefined) {
      patch.tailscaleTailnet = args.tailscaleTailnet || undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
  },
});

export const connectGithub = mutation({
  args: {
    accessToken: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      githubAccessToken: encrypt(args.accessToken),
      githubUsername: args.username,
      githubConnectedAt: Date.now(),
    });
  },
});

export const disconnectGithub = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      githubAccessToken: undefined,
      githubUsername: undefined,
      githubConnectedAt: undefined,
    });
  },
});
