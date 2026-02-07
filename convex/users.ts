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

    // Input length validation
    if (args.hetznerApiKey && args.hetznerApiKey.length > 256) throw new Error("API key too long");
    if (args.tailscaleApiKey && args.tailscaleApiKey.length > 256) throw new Error("API key too long");
    if (args.tailscaleTailnet && args.tailscaleTailnet.length > 128) throw new Error("Tailnet ID too long");

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


