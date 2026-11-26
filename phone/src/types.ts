export type Title = {
  id: string;
  title: string;
  author: string;
  category: string;
  summary: string;
  publishedYear: number | null;
  gutenbergId: number | null;
};
export type Reader = { id: string; email: string; name: string; role: "reader" | "desk" };
export type ShelfResponse = { shelf: Title[]; bookmarks: Title[] };
