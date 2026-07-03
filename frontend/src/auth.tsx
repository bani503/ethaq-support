import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { storage } from "@/src/utils/storage";

export interface UserProfile {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
  subscription_status?: string;
  subscription_plan?: string | null;
  subscription_current_period_end?: string | null;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

const TOKEN_KEY = "ithaq_auth_token";

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    try { window.localStorage.setItem(TOKEN_KEY, token); } catch {}
  } else {
    await storage.secureSet(TOKEN_KEY, token);
  }
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  return storage.secureGet<string>(TOKEN_KEY, "");
}

async function clearToken() {
  if (Platform.OS === "web") {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch {}
  } else {
    await storage.secureRemove(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  const fetchMe = useCallback(async (t: string): Promise<UserProfile | null> => {
    try {
      const r = await fetch(`${backendUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.status === 200) {
        const j = await r.json();
        return j.user;
      }
    } catch {}
    return null;
  }, [backendUrl]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const u = await fetchMe(token);
    if (u) setUser(u);
  }, [token, fetchMe]);

  const exchangeSessionId = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        // 1. Verify with Emergent to get the session_token
        const r = await fetch(
          "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
          { headers: { "X-Session-ID": sessionId } },
        );
        if (!r.ok) return false;
        const data = await r.json();
        const st = data.session_token;
        if (!st) return false;
        // 2. Register with our backend
        const br = await fetch(`${backendUrl}/api/auth/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: st }),
        });
        if (!br.ok) return false;
        const bj = await br.json();
        await saveToken(st);
        setToken(st);
        setUser(bj.user);
        return true;
      } catch (e) {
        console.log("exchange failed", e);
        return false;
      }
    },
    [backendUrl],
  );

  const signIn = useCallback(async () => {
    let redirectUrl: string;
    if (Platform.OS === "web") {
      redirectUrl = window.location.origin + "/";
    } else {
      redirectUrl = Linking.createURL("auth");
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const parsed = new URL(result.url);
        let sessionId = parsed.searchParams.get("session_id");
        if (!sessionId && parsed.hash) {
          const h = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
          const params = new URLSearchParams(h);
          sessionId = params.get("session_id");
        }
        if (sessionId) {
          await exchangeSessionId(sessionId);
        }
      }
    } catch (e) {
      console.log("signIn error", e);
    }
  }, [exchangeSessionId]);

  const signOut = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${backendUrl}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    await clearToken();
    setToken(null);
    setUser(null);
  }, [token, backendUrl]);

  useEffect(() => {
    (async () => {
      try {
        // Handle web #session_id first
        if (Platform.OS === "web") {
          const hash = window.location.hash || "";
          const search = window.location.search || "";
          const h = hash.startsWith("#") ? hash.slice(1) : hash;
          const hashParams = new URLSearchParams(h);
          const queryParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
          const sid = hashParams.get("session_id") || queryParams.get("session_id");
          if (sid) {
            const ok = await exchangeSessionId(sid);
            if (ok) {
              try {
                window.history.replaceState(null, "", window.location.pathname);
              } catch {}
            }
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) {
            try {
              const parsed = new URL(initial);
              let sid = parsed.searchParams.get("session_id");
              if (!sid && parsed.hash) {
                const h = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
                sid = new URLSearchParams(h).get("session_id");
              }
              if (sid) {
                await exchangeSessionId(sid);
                setLoading(false);
                return;
              }
            } catch {}
          }
        }
        // Otherwise check stored token
        const t = await loadToken();
        if (t) {
          const u = await fetchMe(t);
          if (u) {
            setToken(t);
            setUser(u);
          } else {
            await clearToken();
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [exchangeSessionId, fetchMe]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function apiFetch(path: string, token: string | null, options: RequestInit = {}) {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${backendUrl}${path}`, { ...options, headers });
  return r;
}
