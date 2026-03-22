/**
 * Alpha quest chain — hardcoded 4-leg quest around Adams Point / Grand Lake.
 * Application layer: composes domain + infrastructure.
 */

import type { SessionId } from "@/domain/player/player-session";
import type { Quest } from "@/domain/quest/quest";
import { generateQuest, makeAlphaItem } from "@/domain/quest/quest-generator";
import type { QuestLegTemplate } from "@/domain/quest/quest-generator";
import {
  OAKTOWN_SPICE_SHOP,
  GRAND_LAKE_THEATER,
  LAKE_MERRITT_PERGOLA,
  FAIRYLAND_ENTRANCE,
} from "@/infrastructure/providers/map/adams-point-places";

const ALPHA_LEGS: readonly QuestLegTemplate[] = [
  {
    place: OAKTOWN_SPICE_SHOP,
    objectiveText: "Run to Oaktown Spice Shop and acquire the Mystic Cinnamon",
    rewardItem: makeAlphaItem("Mystic Cinnamon", "A fragrant bark imbued with lakeside magic."),
  },
  {
    place: GRAND_LAKE_THEATER,
    objectiveText: "Deliver the cinnamon to the Grand Lake Theater marquee",
    rewardItem: makeAlphaItem("Silver Ticket Stub", "A shimmering ticket to a show that never ends."),
  },
  {
    place: LAKE_MERRITT_PERGOLA,
    objectiveText: "Seek the ancient wisdom at the Lake Merritt Pergola",
    rewardItem: makeAlphaItem("Pergola Scroll", "A weathered scroll with secrets of the lake."),
  },
  {
    place: FAIRYLAND_ENTRANCE,
    objectiveText: "Complete your quest at the gates of Fairyland",
    rewardItem: makeAlphaItem("Fairyland Key", "A golden key that unlocks stories."),
  },
];

export function createAlphaQuest(sessionId: SessionId): Quest {
  return generateQuest(
    sessionId,
    "The Grand Lake Expedition",
    "A mysterious trail of spices and stories leads around the lake. Follow it to unlock the secrets of Adams Point.",
    ALPHA_LEGS,
  );
}
