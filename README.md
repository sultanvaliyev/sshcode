# SSHCode

One-click provisioning of persistent [OpenCode](https://opencode.ai) & [Claude Code](https://claude.ai/claude-code) servers on Hetzner, accessible from any device via Tailscale.

You bring your own Hetzner and Tailscale accounts. SSHCode creates a cloud VM, installs your chosen AI coding agents, connects it to your private Tailscale network, and gives you browser-based access from any device.

```
You (any device)
  │
  └──▶ Tailscale VPN ──▶ Hetzner VM
                          ├── OpenCode    :4096  (web UI)
                          ├── Claude Code :4097  (web terminal via ttyd)
                          └── Bash        :4099  (web terminal via ttyd)
```

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Setup](#step-by-step-setup)
  - [1. Clone and Install](#1-clone-and-install)
  - [2. Set Up Clerk (Auth)](#2-set-up-clerk-auth)
  - [3. Set Up Convex (Backend)](#3-set-up-convex-backend)
  - [4. Generate Encryption Key](#4-generate-encryption-key)
  - [5. Configure Environment Variables](#5-configure-environment-variables)
  - [6. GitHub OAuth (Optional)](#6-github-oauth-optional)
  - [7. Run the Dev Server](#7-run-the-dev-server)
- [Getting Your API Keys](#getting-your-api-keys)
  - [Hetzner Cloud API Token](#hetzner-cloud-api-token)
  - [Tailscale API Key](#tailscale-api-key)
  - [Tailscale ACL Tags](#tailscale-acl-tags)
- [Usage](#usage)
  - [First-Time Setup](#first-time-setup)
  - [Deploying a Server](#deploying-a-server)
  - [Connecting to Your Server](#connecting-to-your-server)
  - [Managing Agents](#managing-agents)
- [Deploy to Production](#deploy-to-production)
- [Architecture](#architecture)
- [Security](#security)
- [Ports Reference](#ports-reference)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| [Node.js](https://nodejs.org) 20+ | Runtime for Next.js and Convex CLI |
| [Clerk](https://clerk.com) account | Authentication — free tier works |
| [Convex](https://convex.dev) account | Backend & database — free tier works |
| [Hetzner Cloud](https://hetzner.com/cloud) account | Server provisioning — pay-as-you-go |
| [Tailscale](https://tailscale.com) account | Private VPN access — free for personal use |

You will also need Tailscale installed on every device you want to access your servers from (laptop, phone, tablet).

---

## Quick Start

If you're familiar with Next.js, Clerk, and Convex, here's the short version:

```bash
git clone <repo-url> sshcode && cd sshcode
npm install

# Start Convex (creates project on first run)
npx convex dev

# Generate and set encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx convex env set ENCRYPTION_KEY <your-64-char-hex>

# Set Clerk issuer URL in Convex
npx convex env set CLERK_ISSUER_URL https://your-instance.clerk.accounts.dev

# Create .env.local (see step 5 below for full template)

# Start Next.js
npm run dev
```

Open http://localhost:3000, sign up, add your API keys in Settings, and deploy a server.

---

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone <repo-url> sshcode
cd sshcode
npm install
```

### 2. Set Up Clerk (Auth)

Clerk handles user authentication (sign-up, sign-in, session management).

1. Create a new application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Choose your sign-in methods (email, Google, GitHub — whatever you prefer)
3. From the **API Keys** page, copy:
   - **Publishable Key** (`pk_test_...` or `pk_live_...`)
   - **Secret Key** (`sk_test_...` or `sk_live_...`)
4. Go to **Configure > JWT Templates** and create a new template:
   - Name: `convex`
   - Leave the default claims
5. Note your **Issuer URL** from the JWT template — it looks like `https://your-instance.clerk.accounts.dev`

### 3. Set Up Convex (Backend)

Convex is the backend — it stores data, runs server functions, and handles cron jobs.

```bash
npx convex dev
```

On first run this will:
- Prompt you to log in to Convex
- Create a new project (or link to an existing one)
- Deploy your schema and functions
- Start watching for changes

**Keep this terminal running** during development. It live-syncs your backend code.

After the project is created, set the Clerk issuer URL as a Convex environment variable. You can do this in a second terminal:

```bash
npx convex env set CLERK_ISSUER_URL https://your-instance.clerk.accounts.dev
```

Or set it in the [Convex dashboard](https://dashboard.convex.dev) under **Settings > Environment Variables**.

### 4. Generate Encryption Key

SSHCode encrypts your Hetzner and Tailscale API keys at rest using NaCl secretbox (XSalsa20-Poly1305). You need a 32-byte master key.

Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs a 64-character hex string. **Save it somewhere safe** (password manager). If you lose this key, all encrypted API keys stored in Convex become unrecoverable.

Set it as a Convex environment variable:

```bash
npx convex env set ENCRYPTION_KEY <your-64-char-hex-string>
```

### 5. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Clerk (from step 2)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex (printed when you ran `npx convex dev`)
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Clerk routing
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### 6. GitHub OAuth (Optional)

SSHCode can optionally connect to GitHub so that provisioned servers have your git credentials pre-configured (for cloning private repos, pushing code, etc.).

To enable this:

1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set:
   - **Application name:** SSHCode (or anything)
   - **Homepage URL:** `http://localhost:3000` (or your production URL)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/github/callback`
4. Copy the **Client ID** and generate a **Client Secret**

Add to `.env.local`:

```env
# GitHub OAuth (optional)
GITHUB_CLIENT_ID=Iv1.abc123...
GITHUB_CLIENT_SECRET=abc123...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production, update `NEXT_PUBLIC_APP_URL` and the GitHub callback URL to your deployed domain.

### 7. Run the Dev Server

Make sure `npx convex dev` is running in one terminal, then in another:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Getting Your API Keys

After signing in, go to **Settings** in the dashboard to add your infrastructure API keys.

### Hetzner Cloud API Token

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Select your project (or create one)
3. Navigate to **Security > API Tokens**
4. Click **Generate API Token**
5. Give it a name and select **Read & Write** permissions
6. Copy the token — it's only shown once

Paste it into SSHCode Settings under **Hetzner API Key**.

### Tailscale API Key

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Under **Settings > Keys**, click **Generate access token...**
3. Copy the API key

Also note your **Tailnet name** from **Settings > General**. For personal accounts you can use `-` as the tailnet name.

Paste both into SSHCode Settings under **Tailscale API Key** and **Tailscale Tailnet**.

### Tailscale ACL Tags

SSHCode tags every provisioned VM with `tag:sshcode`. You need to allow this tag in your Tailscale ACL policy.

1. Go to [Tailscale ACL editor](https://login.tailscale.com/admin/acls)
2. Add to your policy file:

```jsonc
{
  "tagOwners": {
    "tag:sshcode": ["autogroup:admin"]
  },
  // ... rest of your ACL policy
}
```

This lets admin users (you) create devices with the `tag:sshcode` tag.



## Usage

### First-Time Setup

1. Open SSHCode and sign up / sign in
2. Go to **Settings**
3. Add your **Hetzner API Key**, **Tailscale API Key**, and **Tailscale Tailnet**
4. (Optional) Connect your GitHub account
5. Make sure you've configured the [Tailscale ACL tag](#tailscale-acl-tags)

### Deploying a Server

1. Click **Deploy New Server** from the dashboard
2. Choose a **region**:
   - Ashburn, VA (US East)
   - Hillsboro, OR (US West)
   - Nuremberg, Germany (EU)
   - Helsinki, Finland (EU)
3. Choose a **server size** (2 vCPU / 4GB RAM or 4 vCPU / 8GB RAM)
4. Select **agents** — OpenCode, Claude Code, or both
5. Click **Deploy**

SSHCode will:
- Create a Tailscale auth key
- Provision a Hetzner VM with Ubuntu 24.04
- Run a cloud-init script that installs Tailscale, your chosen agents, and a management API
- Poll until setup completes (~2-5 minutes)

You can watch the provisioning progress in real-time on the server detail page.

### Connecting to Your Server

Once the server status shows **Running**, you'll see connection URLs on the server detail page:

| Service | URL | Auth |
|---------|-----|------|
| OpenCode | `http://<server-name>.<tailnet>.ts.net:4096` | Server password |
| Claude Code | `http://<server-name>.<tailnet>.ts.net:4097` | Server username + password |
| Bash Terminal | `http://<server-name>.<tailnet>.ts.net:4099` | Server username + password |

These URLs are only accessible through your Tailscale network. Make sure Tailscale is installed and running on the device you're connecting from.

The server detail page shows your credentials and has copy-to-clipboard buttons for each URL.

### Managing Agents

From the server detail page you can:

- **Install / uninstall agents** — add or remove OpenCode and Claude Code on a running server
- **Reset credentials** — change the server username and password
- **Delete server** — removes the VM from Hetzner and cleans up the database record

---

## Deploy to Production

### Frontend (Vercel)

The easiest way to deploy the Next.js frontend:

1. Push your code to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all `.env.local` variables to the Vercel project's environment settings
4. Deploy

Or deploy manually:

```bash
npm run build
# Deploy the output to any Node.js-compatible host
```

If you set up GitHub OAuth, update:
- `NEXT_PUBLIC_APP_URL` to your production domain
- The GitHub OAuth callback URL to `https://yourdomain.com/api/auth/github/callback`

### Backend (Convex)

Deploy your Convex functions to production:

```bash
npx convex deploy
```

Make sure these environment variables are set in the **production** Convex environment (via the dashboard or CLI):

```
ENCRYPTION_KEY=<your-64-char-hex>
CLERK_ISSUER_URL=https://your-instance.clerk.accounts.dev
```

If you're using a separate Clerk production instance, update the issuer URL accordingly.

---

## Architecture

```
┌───────────────┬──────────────────────────────┐
│  Next.js Frontend (Vercel)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Dashboard │  │ Settings │  │ Auth      │  │
│  │ (servers) │  │ (keys)   │  │ (Clerk)   │  │
│  └─────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│        └──────┬───────┘              │        │
│               │                      │        │
│         ┌─────▼─────┐         ┌─────▼─────┐  │
│         │  Convex   │         │   Clerk   │  │
│         │  Client   │         │   Auth    │  │
│         └─────┬─────┘         └───────────┘  │
└───────────────┼──────────────────────────────┘
                │
   ┌────────────▼────────────┐
   │     Convex Backend      │
   │                         │
   │  • Queries / Mutations  │
   │  • Actions (HTTP calls) │
   │  • 5-min health cron    │
   │  • NaCl encryption      │
   │                         │
   │  Calls out to:          │
   │  ├─ Hetzner Cloud API   │
   │  ├─ Tailscale API       │
   │  └─ Server Mgmt API     │
   └─────────────────────────┘
                │
     ┌──────────┼──────────┐
     │          │          │
 ┌────▼────┐ ┌──▼───┐ ┌───▼──────────┐
 │ Hetzner │ │ TS   │ │ Hetzner VM   │
 │ API     │ │ API  │ │              │
 └─────────┘ └──────┘ │ • Tailscale  │
                      │ • OpenCode   │
                      │ • Claude Code│
                      │ • Mgmt API   │
                      │ • UFW        │
                      └──────────────┘
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, React 19) |
| Auth | Clerk |
| Backend & DB | Convex (queries, mutations, actions, crons) |
| Provisioning | Hetzner Cloud API (cloud-init) |
| Networking | Tailscale (MagicDNS, VPN) |
| Encryption | tweetnacl (NaCl secretbox / XSalsa20-Poly1305) |
| Styling | Tailwind CSS v4 |

---

## Security

- **API keys encrypted at rest** — Hetzner and Tailscale tokens are encrypted using NaCl secretbox (XSalsa20-Poly1305) before being stored in Convex. Each encrypted value uses a unique random nonce.
- **Encryption key isolation** — the master key is stored as a Convex environment variable, separate from the database.
- **UFW firewall** — provisioned servers block all inbound traffic on agent ports from the public internet. Only Tailscale interface traffic is allowed.
- **Settings are write-only** — the Settings page never displays stored API keys back to the user. You can only overwrite them.
- **Tailscale VPN** — all access to servers goes through your private Tailscale network. Nothing is exposed to the public internet.

---

## Ports Reference

| Port | Service | Access |
|------|---------|--------|
| 4096 | OpenCode web UI | Tailscale only |
| 4097 | Claude Code terminal (ttyd) | Tailscale only |
| 4098 | Management API (internal) | Tailscale only |
| 4099 | Bash web terminal (ttyd) | Tailscale only |
| 22   | SSH | Public (key-only) |

---

## Troubleshooting

**"Hetzner API key required" when creating a server**
Go to Settings and add your Hetzner API Token. The key must have **Read & Write** permissions.

**"Tailscale API key required" when creating a server**
Go to Settings and add both your Tailscale API Key and Tailnet name.

**Server stuck on "installing" for more than 10 minutes**
Cloud-init may have failed. The setup script logs to `/var/log/sshcode-setup.log` on the VM. You can SSH into the server using the public IP (shown in Hetzner Console) and check the log.

**Can't access server URLs after deployment**
Make sure Tailscale is running on the device you're connecting from and that you're logged into the same Tailscale account. The URLs use MagicDNS and are only reachable within your tailnet.

**"tag:sshcode is not valid" error during provisioning**
You need to add the tag to your Tailscale ACL policy. See [Tailscale ACL Tags](#tailscale-acl-tags).

**Sign-in redirects back to the home page instead of dashboard**
Make sure `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard` is set in your `.env.local`.

**`@convex/_generated/api` not found (TypeScript error)**
Make sure `npx convex dev` is running. It generates the type-safe API client. Also check that `tsconfig.json` has the `@convex/*` path alias pointing to `./convex/*`.

---

## License

MIT
