import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";
import type { Reader } from "./types";

type AuthState = {
  reader: Reader | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ emailSent: boolean }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (getToken()) {
          try {
            setReader(await api.request<Reader>("/session/me"));
            setReady(true);
            return;
          } catch {
            setToken(null);
          }
        }
        const guest = await api.request<{ token: string }>("/session/guest", { method: "POST" });
        setToken(guest.token);
      } catch {
        // The catalog handles offline retries separately; anonymous browsing still works without a token.
      } finally {
        setReady(true);
      }
    };
    void initialize();
  }, []);

  const state = useMemo<AuthState>(() => ({
    reader,
    ready,
    async login(email, password) {
      const result = await api.request<{ token: string; reader: Reader }>("/session/login", {
        method: "POST", body: JSON.stringify({ email, password })
      });
      setToken(result.token);
      setReader(result.reader);
    },
    async register(name, email, password) {
      // The account is created unverified: no session until the emailed code is confirmed.
      const result = await api.request<{ emailSent: boolean }>("/session/register", {
        method: "POST", body: JSON.stringify({ name, email, password })
      });
      return { emailSent: result.emailSent };
    },
    async verifyEmail(email, code) {
      const result = await api.request<{ token: string; reader: Reader }>("/session/verify-email", {
        method: "POST", body: JSON.stringify({ email, code })
      });
      setToken(result.token);
      setReader(result.reader);
    },
    async resendCode(email) {
      await api.request("/session/resend-code", { method: "POST", body: JSON.stringify({ email }) });
    },
    async forgotPassword(email) {
      await api.request("/session/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    },
    async resetPassword(email, code, newPassword) {
      await api.request("/session/reset-password", { method: "POST", body: JSON.stringify({ email, code, newPassword }) });
    },
    async logout() {
      try {
        await api.request("/session/logout", { method: "POST" });
      } finally {
        setReader(null);
        setToken(null);
      }
    }
  }), [reader, ready]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
