// Small talk. Lines get warmer as hearts grow (0 → 1–2 → 3+).

export const CHATTER: Record<string, [string[], string[], string[]]> = {
  gull: [
    ["Mail doesn't deliver itself! Well. It does now. You're it.", "Win them over one letter at a time. Hearts become votes, votes save the post office."],
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

// New faces in the square, plus the villain.
Object.assign(CHATTER, {
  dot: [
    ["Mm. Swiftline drops my flour on the doorstep at 5am. Cheap, at least.", "Bread waits for no one. Neither does Swiftline."],
    ["You're quick! Bread's still warm when your letters come.", "Try a honey bun. Folks love being brought one."],
    ["Best courier this town's had since Marlo. Don't tell her I said that. Oh. Sorry, love."],
  ],
  pell: [
    ["Swiftline gives me thirty percent off. Can you beat thirty percent?", "Paper is serious business. So is postage."],
    ["Your deliveries are… tidy. I respect tidy.", "I sell stamps, you know. For writing to real people."],
    ["My father would have liked you. He loved this post office."],
  ],
  sable: [
    ["That uniform is a crime against fabric, darling.", "Swiftline drones don't wear anything. Very minimalist. I hate it."],
    ["Better! You walk like someone people trust now.", "Fancy a new colour? I do house calls. Well, shop calls."],
    ["You've made this town stylish again. Marlo would be thrilled."],
  ],
  mayor: [
    ["Swiftline's offer is very generous. Very… efficient. I haven't decided.", "The Council votes soon. Make your case, courier. With deliveries."],
    ["People keep telling me about you. Good things, mostly.", "A town is just people who write to each other. Someone said that once."],
    ["Between us? I'm voting for the post office. Don't tell Vane."],
  ],
  vane: [
    ["Director Hollis Vane, Swiftline Logistics. Nothing personal. Efficiency is just… kinder.", "My drones don't get tired, lost, or sentimental. Can you say the same?", "Twenty days, courier. Then this square gets a proper hub."],
    ["You're more stubborn than the numbers said you'd be.", "This town loves its little rituals. Rituals don't scale."],
    ["I grew up here, you know. I left the day the mail stopped coming."],
  ],
});

export function chatter(id: string, hearts: number, day: number): string {
  const tiers = CHATTER[id];
  if (!tiers) return "…";
  const tier = hearts >= 3 ? tiers[2] : hearts >= 1 ? tiers[1] : tiers[0];
  return tier[day % tier.length];
}
