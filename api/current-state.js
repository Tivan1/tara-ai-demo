// What Tara currently "remembers" about recent community events, manually
// updated whenever something big happens (a burn, a popular meme, a milestone).
// The system prompt injects this into every conversation, so Tara reacts
// to the current moment without needing per-user memory.

export const CURRENT_STATE = {
  // Most recent burn stats, pulled from the chain or your analytics.
  // Include a conversational "X days ago" so it doesn't go stale.
  lastBurn: {
    tokens: 1000000, // actual number from the event
    usdValue: 4200,
    timeAgo: "3 days ago",
  },

  // The meme or community post that defined the last 24-48 hours.
  // Link to the original post so Tara can react to the exact content.
  topMemePost: {
    url: "https://example.com/Fy8t7qR",
    topic: "riffing on the 'Turbo smoke' meme",
    timeAgo: "yesterday",
  },

  // The last big community milestone or event.
  // Make the description specific enough to react to: "10,000 holders" (a number)
  // is not as meaningful as "RugDAO gave every Turbo holder a blue pill NFT" (an event).
  lastMilestone: {
    description: "You revealed the secret Diamond Leaper, showing it exists",
    timeAgo: "two days ago",
  },

  // General sentiment: bullish, bearish, or neutral.
  // Use emoji to capture the vibe beyond just the label.
  // This is deliberately subjective — vibe matters more than numbers.
  currentMood: {
    sentiment: "bullish",
    emoji: "🚀🌖",
  },

  // Tara's personal current status.
  // Use this to create small parasocial arcs: if last time she mentioned
  // being away, make the next update acknowledge it ("just got back").
  taraStatus: {
    description: "Finishing up some secret Diamond-tier designs in the Lab 👀",
  },
};

// A quick tester to make sure your JSON is valid:
const test = JSON.stringify(CURRENT_STATE);
if (!test) throw new Error("CURRENT_STATE is not valid JSON");
