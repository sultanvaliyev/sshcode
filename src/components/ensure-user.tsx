"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

export function EnsureUser() {
  const { isSignedIn } = useAuth();
  const getOrCreate = useMutation(api.users.getOrCreate);
  const called = useRef(false);

  useEffect(() => {
    if (isSignedIn && !called.current) {
      called.current = true;
      getOrCreate().catch(console.error);
    }
  }, [isSignedIn, getOrCreate]);

  return null;
}
