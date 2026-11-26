import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Reader, ShelfResponse, Title } from "./types";

const BASE_KEY = "reading-room-api-base";
const TOKEN_KEY = "reading-room-token";
export const DEFAULT_BASE_URL = "http://10.0.2.2:4100";

export async function getBaseUrl() {
  return (await AsyncStorage.getItem(BASE_KEY)) || DEFAULT_BASE_URL;
}

export async function saveBaseUrl(value: string) {
  const clean = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/.+/i.test(clean)) throw new Error("Enter a full URL, such as http://10.0.2.2:4100.");
  await AsyncStorage.setItem(BASE_KEY, clean);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(value: string | null) {
  if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = await getBaseUrl();
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, { ...init, headers });
  } catch {
    throw new Error(`Could not reach the API at ${base}. Check the address and network.`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function signIn(email: string, password: string) {
  const response = await api<{ token: string; reader: Reader }>("/session/login", { method: "POST", body: JSON.stringify({ email, password }) });
  await setToken(response.token);
  return response.reader;
}

export async function signUp(name: string, email: string, password: string) {
  const response = await api<{ token: string; reader: Reader }>("/session/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  await setToken(response.token);
  return response.reader;
}

export async function startGuest() {
  const response = await api<{ token: string }>("/session/guest", { method: "POST" });
  await setToken(response.token);
}

export async function loadShelf() {
  return api<ShelfResponse>("/shelves");
}

export async function addToShelf(titleId: string) {
  return api<{ title: Title }>("/shelves", { method: "POST", body: JSON.stringify({ titleId }) });
}
