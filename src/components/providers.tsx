"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ReactNode, useCallback, useMemo } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function ConvexTokenProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const token = await getToken({
        template: "convex",
        skipCache: forceRefreshToken,
      });
      return token ?? null;
    },
    [getToken, isSignedIn]
  );

  const authState = useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
    }),
    [isLoaded, isSignedIn]
  );

  return (
    <ConvexProviderWithAuth
      client={convex}
      useAuth={() => ({
        ...authState,
        fetchAccessToken,
      })}
    >
      {children}
    </ConvexProviderWithAuth>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexTokenProvider>{children}</ConvexTokenProvider>
    </ClerkProvider>
  );
}
