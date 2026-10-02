// Small talk. Lines get warmer as hearts grow (0 → 1–2 → 3+).

export const CHATTER: Record<string, [string[], string[], string[]]> = {
  gull: [
    ["Mail doesn't deliver itself! Well. It does now. You're it."],
    ["Fine work, courier. The bay hasn't been this chatty in years."],
    ["You know, I was a courier once. Then I took a seagull to the knee."],
  ],
  granny: [
    ["Oh! The new courier. You have kind shoes.", "Watch your step on the cobbles, dear."],
    ["I used to write letters every day. To someone far away. Silly old me.", "Your penguin is very polite. He bowed at me."],
    ["You've put a spring back in this old town's step.", "Some nights I look at the lighthouse and wonder if anyone's home."],
  ],
  mo: [
    ["Welcome to Mo's Mart! We sell snacks. Mostly snacks. Only snacks."],
    ["Wild monsters LOVE a crunchy snack. Ask me and I'll sell you one."],
    ["Mum says the city has no stray monsters. Can you imagine? Sad city."],
  ],
  ada: [
    ["Feeling alright? You look sun-kissed. Drink some water."],
    ["If your feet hurt from walking, that's called 'being a courier'."],
    ["Have a lollipop. Doctor's orders. I have six hundred."],
  ],
  shelly: [
    ["The tide brings in the best stuff. Yesterday: a boot. Today: hope."],
    ["Every shell has a story. This one's says 'I used to be a snail's house.'"],
    ["Tobi and I are going to map every cloud AND every shell. Science!"],
  ],
  rosa: [
    ["Mind the tulips! …Sorry. Hello! I'm Rosa."],
    ["Someone keeps sending me poems. They smell faintly of the sea…"],
    ["Flowers grow better when you talk to them. People too, I think."],
  ],
  tobi: [
    ["Whoa. A person! Up HERE! Are you real?", "I watch the sea every evening. The clouds are better from up here."],
    ["That cloud looks like a penguin. Like YOUR penguin!"],
    ["I have a pen pal now. It's the best job in the world. After yours."],
  ],
  finn: [
    ["…Fish are biting. Words aren't. Got anything for me?"],
    ["Do you think a person can tell if a poem smells like mackerel?"],
    ["Tea went well. I wore a tie. Don't tell anyone. Tell everyone."],
  ],
  captain: [
    ["Ahoy! A swimmer! Haven't had a visitor since… well. Ever."],
    ["Forty years keeping a light that won't light. Stubborn, like me."],
    ["There's a glow on the shore at night. Like flowers. Can't be, surely."],
  ],
};

export function chatter(id: string, hearts: number, day: number): string {
  const tiers = CHATTER[id];
  if (!tiers) return "…";
  const tier = hearts >= 3 ? tiers[2] : hearts >= 1 ? tiers[1] : tiers[0];
  return tier[day % tier.length];
}
