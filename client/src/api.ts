import type { Title, TitlePage, ShelfResponse } from "./types";

const TOKEN_KEY = "reading-room-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `Request failed (${response.status}).`), { code: body.code as string | undefined });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  request,
  titles: (params: URLSearchParams) => request<TitlePage>(`/titles?${params}`),
  title: (id: string) => request<Title>(`/titles/${encodeURIComponent(id)}`),
  shelves: () => request<ShelfResponse>("/shelves"),
  addToShelf: (titleId: string) => request<{ title: Title }>("/shelves", { method: "POST", body: JSON.stringify({ titleId }) }),
  removeFromShelf: (id: string) => request<void>(`/shelves/${encodeURIComponent(id)}`, { method: "DELETE" }),
  addBookmark: (titleId: string) => request<{ title: Title }>("/shelves/bookmarks", { method: "POST", body: JSON.stringify({ titleId }) }),
  removeBookmark: (id: string) => request<void>(`/shelves/bookmarks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  downloadCard: async (id: string) => {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`/api/downloads/${encodeURIComponent(id)}/card.pdf`, { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Download failed (${response.status}).`);
    }
    return response.blob();
  }
};
