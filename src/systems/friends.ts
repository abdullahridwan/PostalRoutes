// The social loop: write a real letter to a friend (it travels as a link), and when a friend's
// link opens the game, their letter arrives in your mailbag addressed to you.
import { save } from "../game/state";
import type { Letter } from "../game/letters";
import type { World } from "../scenes/World";

const NAME_KEY = "postal-route-name";

type Payload = { f: string; t: string; m: string };

function enc(o: Payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function dec(s: string): Payload | null {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    const o = JSON.parse(decodeURIComponent(escape(atob(b + "=".repeat((4 - (b.length % 4)) % 4)))));
    return typeof o.f === "string" && typeof o.m === "string" ? o : null;
  } catch { return null; }
}
const hash = (str: string) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h).toString(36); };

export function writeLetter(w: World) {
  const s = w.state;
  w.say([{
    text: "Your desk, with good paper and a very patient pen. Write a real letter to a friend: they'll open a link, and a penguin will deliver it to them in Seabreeze Bay.",
    choices: [
      { label: "Write a letter", cb: () => compose(w) },
      { label: "Not now", cb: () => {} },
    ],
  }]);
  void s;
}

function compose(w: World) {
  const s = w.state;
  let saved = "";
  try { saved = localStorage.getItem(NAME_KEY) ?? ""; } catch { /* ignore */ }
  const from = (window.prompt("Your name (so they know who it's from):", saved) ?? "").trim().slice(0, 24);
  if (!from) return;
  try { localStorage.setItem(NAME_KEY, from); } catch { /* ignore */ }
  const to = (window.prompt("Who is the letter for?", "") ?? "").trim().slice(0, 24);
  if (!to) return;
  const msg = (window.prompt(`Write your letter to ${to}. Keep it short and sweet:`, "") ?? "").trim().slice(0, 400);
  if (!msg) return;
  const link = `${location.origin}${location.pathname}?l=${enc({ f: from, t: to, m: msg })}`;
  if (!s.sent.includes(to)) s.sent.push(to);
  save(s);
  let copied = false;
  try { void navigator.clipboard.writeText(link); copied = true; } catch { /* ignore */ }
  w.say([
    { text: `Sealed with a drop of wax! ✉\n${copied ? "The link is copied to your clipboard. " : ""}Send it to ${to}.` },
    { text: `When ${to} opens it, the letter arrives in their mailbag, addressed to them. Here's the link:\n${link.length > 160 ? link.slice(0, 160) + "…" : link}` },
  ]);
  console.info("Postal Route letter link:", link);
}

/** Called when the game starts: a friend's link adds their letter to your mailbag. */
export function checkIncoming(w: World) {
  const s = w.state;
  const raw = new URLSearchParams(location.search).get("l");
  if (!raw) return;
  const p = dec(raw);
  if (!p) return;
  const id = `friend-${hash(raw)}`;
  try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ }
  if (s.receivedLetters.some((l) => l.from + l.body === p.f + p.m && s.delivered.includes(id))) return;
  if (s.bag.includes(id) || s.delivered.includes(id)) return;
  const l: Letter = { id, to: "you", from: p.f, title: `A letter from ${p.f}`, body: p.m, fromId: undefined };
  s.extraLetters[id] = l;
  s.bag.push(id);
  save(s);
  w.time.delayedCall(1500, () => w.ui.toast(`✉ A sealed letter from ${p.f} is in your mailbag! Take it to Postmaster Gull.`));
}

/** Gull hands over a letter written to you by a real friend. */
export function receive(w: World, l: Letter) {
  const s = w.state;
  s.bag = s.bag.filter((x) => x !== l.id);
  s.delivered.push(l.id);
  s.receivedLetters.push({ from: l.from, body: l.body });
  const first = !s.postmarks.includes(l.from);
  if (first) s.postmarks.push(l.from);
  s.coins += 15;
  save(s);
  w.ui.showLetter(l, "You", () => {
    w.say([
      { text: first ? `A new postmark: ${l.from}! It's in your Postmark Book upstairs.` : `Another letter from ${l.from}. The pages are getting full.` },
      { text: "You could write back: your desk is in the flat upstairs. (+15c for the fresh stamp.)" },
    ], () => w.refresh());
  });
}

export function postmarkBook(w: World) {
  const s = w.state;
  const pages = ["Seabreeze Bay (Grandma Marlo's stamp)", ...s.postmarks.map((p) => `${p}`)];
  const lines = Array.from({ length: 8 }, (_, i) => (pages[i] ? `✉ ${pages[i]}` : `· · · (empty page ${i + 1}: a future village, or a friend)`));
  w.say([{ text: `POSTMARK BOOK\n${lines.join("\n")}\nLetters sent: ${s.sent.length ? s.sent.join(", ") : "none yet"}.` }]);
}
