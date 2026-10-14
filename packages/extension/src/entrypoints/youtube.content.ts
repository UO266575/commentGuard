import { CONFIDENCE_THRESHOLD } from "@comment-classificator/shared";

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  main() {
    // Placeholder: the real comment-replacement UI lands in a later phase.
    console.log(`[CommentGuard] loaded (threshold ${CONFIDENCE_THRESHOLD})`);
  },
});
