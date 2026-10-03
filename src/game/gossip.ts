// Villagers talking amongst themselves about what the courier did.
// {A} = the one it happened to, {B} = the friend hearing it. Shared by every villager.

const LINES: Record<string, [string, string][]> = {
  speedy: [
    ["The new courier got my mail to me before I'd finished my tea!", "Before tea? Swiftline can't do that."],
    ["Fastest delivery I've had in years.", "Huh. Maybe I'll give them a try."],
  ],
  in_person: [
    ["They handed my letter over in person. Like the old days.", "Marlo used to do that, you know."],
    ["The courier actually said good morning to me.", "A drone has never said good morning to me."],
  ],
  delivered: [
    ["Got my post today. On time, and not soggy.", "That's more than I can say for Swiftline."],
    ["The courier's working hard, I'll give them that.", "Every day, rain or shine."],
  ],
  drone_beat: [
    ["A Swiftline drone dropped my letter in a puddle.", "Ugh. Why's the courier so slow, then?"],
    ["Swiftline got to me first again.", "Shame. I wanted to like that courier."],
  ],
  gift: [
    ["The courier brought me a honey bun! Just because!", "...Do you think they'd bring me one?"],
    ["Such a sweet thing they did today.", "I'm starting to think they're alright."],
  ],
  chat: [
    ["The courier stopped to chat with me today.", "They're friendlier than I expected."],
  ],
  beat_drone: [
    ["The courier raced a drone to my door and WON.", "Ha! Take that, Swiftline."],
  ],
};

export function gossipLines(type: string, seed: number): [string, string] {
  const opts = LINES[type] ?? LINES.delivered;
  return opts[Math.abs(seed) % opts.length];
}
