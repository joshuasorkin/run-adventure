import { describe, it, expect } from "vitest";
import { filterSafePlaces } from "@/domain/safety/accessibility";
import { makePlaceCandidate } from "@tests/fixtures/factories";

describe("filterSafePlaces", () => {
  it("keeps accessible outdoor places", () => {
    const place = makePlaceCandidate({ isAccessible: true, isOutdoor: true });
    const result = filterSafePlaces([place]);
    expect(result).toHaveLength(1);
  });

  it("filters out inaccessible places", () => {
    const place = makePlaceCandidate({ isAccessible: false, isOutdoor: true });
    const result = filterSafePlaces([place]);
    expect(result).toHaveLength(0);
  });

  it("filters out indoor places", () => {
    const place = makePlaceCandidate({ isAccessible: true, isOutdoor: false });
    const result = filterSafePlaces([place]);
    expect(result).toHaveLength(0);
  });

  it("filters mixed set correctly", () => {
    const places = [
      makePlaceCandidate({ name: "Park", isAccessible: true, isOutdoor: true }),
      makePlaceCandidate({ name: "Office", isAccessible: false, isOutdoor: false }),
      makePlaceCandidate({ name: "Garden", isAccessible: true, isOutdoor: true }),
      makePlaceCandidate({ name: "Garage", isAccessible: true, isOutdoor: false }),
    ];
    const result = filterSafePlaces(places);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toEqual(["Park", "Garden"]);
  });

  it("returns empty for empty input", () => {
    expect(filterSafePlaces([])).toEqual([]);
  });
});
