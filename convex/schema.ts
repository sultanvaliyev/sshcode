import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),

    // Hetzner
    hetznerApiKey: v.optional(v.string()),   // encrypted via NaCl secretbox
    hetznerProjectId: v.optional(v.string()),

    // Tailscale
    tailscaleApiKey: v.optional(v.string()), // encrypted via NaCl secretbox
    tailscaleTailnet: v.optional(v.string()),

    plan: v.union(v.literal("free"), v.literal("pro")),
    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"]),

  servers: defineTable({
    userId: v.id("users"),

    // Hetzner details
    hetznerServerId: v.string(),
    hetznerIp: v.string(),
    region: v.string(),                      // "ash" | "hil" | "nbg1" | "fsn1" | "hel1"
    serverType: v.string(),                  // "cx23" | "cx33" | "cpx21" | "cpx31"

    // Tailscale details
    tailscaleName: v.optional(v.string()),   // e.g. "sshcode-abc123"
    tailscaleDomain: v.optional(v.string()), // e.g. "taila43c9d.ts.net"
    tailscaleIp: v.optional(v.string()),     // 100.x.x.x

    // Agent config
    agents: v.array(v.union(
      v.literal("opencode"),
      v.literal("claude-code"),
      v.literal("codex")
    )),
    opencodePort: v.optional(v.number()),    // default 4096
    claudeCodePort: v.optional(v.number()),  // default 4097 (via ttyd)
    codexPort: v.optional(v.number()),       // default 4100 (via ttyd)
    serverUsername: v.optional(v.string()),   // default "sshcode"
    serverPassword: v.string(),              // encrypted via NaCl secretbox

    // Status
    status: v.union(
      v.literal("provisioning"),
      v.literal("installing"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("deleting")
    ),
    statusMessage: v.optional(v.string()),
    lastHealthCheck: v.optional(v.number()),
    healthStatus: v.optional(v.union(
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("unreachable")
    )),

    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_hetznerServerId", ["hetznerServerId"]),

  provisioningLogs: defineTable({
    serverId: v.id("servers"),
    step: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("error")
    ),
    message: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_serverId", ["serverId"]),
});
