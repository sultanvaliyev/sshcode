const CLERK_ISSUER_URL = "https://funky-lynx-99.clerk.accounts.dev";

export default {
  providers: [
    {
      domain: CLERK_ISSUER_URL,
      applicationID: "convex",
    },
  ],
};
