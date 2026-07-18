import { CURRENT_STATE } from "./current-state.js";

// Read-only, no key required. Powers the "Last Events" page — separate from
// tara-prompt.js's own use of CURRENT_STATE, so the two stay decoupled:
// this can be cached/CDN'd publicly, the prompt-building path never is.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=60"); // light caching, state changes rarely
  res.status(200).json(CURRENT_STATE);
}
