import { findTitles, prepareShelfSave, readRecords } from "./tools.js";

function comparisonQueries(message: string) {
  if (!/\b(compare|comparison|difference)\b/i.test(message)) return [];
  const cleaned = message
    .replace(/^\s*(?:please\s+)?(?:could|can|would)\s+you\s+/i, "")
    .replace(/^\s*how\s+(?:do|does)\s+/i, "")
    .replace(/^\s*what\s+(?:is|are)\s+/i, "")
    .replace(/\b(?:the\s+)?differences?\s+between\b|\bdifference\s+between\b|\bcomparison(?:\s+of)?\b|\bcompare(?:s|d)?\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(/^(.+?)\s+(?:and|with|to|versus|vs\.?)\s+(.+?)$/i);
  if (!match) return [];
  return [match[1].trim(), match[2].trim()].filter(Boolean);
}

function searchPhrase(message: string) {
  return message
    .replace(/\b(please|could you|can you|would you|find|search for|look up|tell me about|what do you know about|book|title|by|author|add|save|put|on my shelf|to my shelf|compare|comparison|the difference between|and|versus|vs\.?)\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function answerLibrarian(message: string) {
  const queries = comparisonQueries(message);
  if (queries.length) {
    const matches = await Promise.all(queries.map(findTitles));
    const ids = [...new Set(matches.flatMap((items) => items.map((item) => item.id)))];
    const records = await readRecords(ids);
    if (!ids.length) return { text: "I couldn't find those titles in the catalog.", records: [], pendingSave: null };
    return { text: "Here are the catalog records I found for comparison.", records, pendingSave: null };
  }

  const query = searchPhrase(message);
  const matches = await findTitles(query || message);
  const wantsSave = /\b(add|save|put)\b.*\b(shelf|reading list)\b|\b(shelf|reading list)\b.*\b(add|save|put)\b/i.test(message);
  if (!matches.length) return { text: "I couldn't find a matching record. Try a title, author, or category.", records: [], pendingSave: null };
  const records = await readRecords(matches.slice(0, 5).map((item) => item.id));
  if (wantsSave) {
    const prepared = records.length === 1 ? await prepareShelfSave(records[0].id) : null;
    return prepared
      ? { text: `I found ${prepared.title.title} by ${prepared.title.author}. Confirm below to add it to your shelf.`, records, pendingSave: prepared.title }
      : { text: "I found a few possible titles. Ask about one title by name so I can prepare the right shelf addition.", records, pendingSave: null };
  }
  return { text: `I found ${records.length} ${records.length === 1 ? "record" : "records"} in the live catalog.`, records, pendingSave: null };
}
