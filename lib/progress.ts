// Lesson progress, stored in the browser.
export interface Progress { done: Record<string, number>; xp: number; streak: number; lastDay: string }
const KEY = "openfile-learn";
export const EMPTY: Progress = { done: {}, xp: 0, streak: 0, lastDay: "" };

export function loadProgress(): Progress {
  try { const s = localStorage.getItem(KEY); if (s) return { ...EMPTY, ...JSON.parse(s) }; } catch { /* ignore */ }
  return EMPTY;
}
export function saveProgress(p: Progress) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }

const day = (d: Date) => d.toLocaleDateString("en-CA");
export function completeLesson(p: Progress, key: string, stars: number): Progress {
  const prev = p.done[key] ?? 0;
  const today = new Date(), yest = new Date(Date.now() - 864e5);
  const streak = p.lastDay === day(today) ? p.streak : p.lastDay === day(yest) ? p.streak + 1 : 1;
  return { done: { ...p.done, [key]: Math.max(prev, stars) }, xp: p.xp + (prev === 0 ? 20 : 5), streak, lastDay: day(today) };
}
