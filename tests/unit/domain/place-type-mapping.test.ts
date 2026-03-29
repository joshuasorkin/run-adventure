import { describe, it, expect } from "vitest";
import {
  googleTypeToDomainCategory,
  domainCategoryToGoogleTypes,
} from "@/infrastructure/providers/map/place-type-mapping";

describe("googleTypeToDomainCategory", () => {
  it("maps park → park", () => {
    expect(googleTypeToDomainCategory("park")).toBe("park");
  });

  it("maps restaurant → restaurant", () => {
    expect(googleTypeToDomainCategory("restaurant")).toBe("restaurant");
  });

  it("maps cafe → cafe", () => {
    expect(googleTypeToDomainCategory("cafe")).toBe("cafe");
  });

  it("maps coffee_shop → cafe", () => {
    expect(googleTypeToDomainCategory("coffee_shop")).toBe("cafe");
  });

  it("maps library → library", () => {
    expect(googleTypeToDomainCategory("library")).toBe("library");
  });

  it("maps museum → museum", () => {
    expect(googleTypeToDomainCategory("museum")).toBe("museum");
  });

  it("maps pharmacy → pharmacy", () => {
    expect(googleTypeToDomainCategory("pharmacy")).toBe("pharmacy");
  });

  it("maps supermarket → market", () => {
    expect(googleTypeToDomainCategory("supermarket")).toBe("market");
  });

  it("maps grocery_store → market", () => {
    expect(googleTypeToDomainCategory("grocery_store")).toBe("market");
  });

  it("maps performing_arts_theater → theater", () => {
    expect(googleTypeToDomainCategory("performing_arts_theater")).toBe("theater");
  });

  it("maps movie_theater → theater", () => {
    expect(googleTypeToDomainCategory("movie_theater")).toBe("theater");
  });

  it("maps bakery → bakery", () => {
    expect(googleTypeToDomainCategory("bakery")).toBe("bakery");
  });

  it("maps bar → bar", () => {
    expect(googleTypeToDomainCategory("bar")).toBe("bar");
  });

  it("maps school → school", () => {
    expect(googleTypeToDomainCategory("school")).toBe("school");
  });

  it("maps university → school", () => {
    expect(googleTypeToDomainCategory("university")).toBe("school");
  });

  it("maps gym → gym", () => {
    expect(googleTypeToDomainCategory("gym")).toBe("gym");
  });

  it("maps fitness_center → gym", () => {
    expect(googleTypeToDomainCategory("fitness_center")).toBe("gym");
  });

  it("maps store → store", () => {
    expect(googleTypeToDomainCategory("store")).toBe("store");
  });

  it("maps book_store → store", () => {
    expect(googleTypeToDomainCategory("book_store")).toBe("store");
  });

  it("maps hiking_area → trailhead", () => {
    expect(googleTypeToDomainCategory("hiking_area")).toBe("trailhead");
  });

  it("maps monument → statue", () => {
    expect(googleTypeToDomainCategory("monument")).toBe("statue");
  });

  it("maps garden → garden", () => {
    expect(googleTypeToDomainCategory("garden")).toBe("garden");
  });

  it("maps playground → playground", () => {
    expect(googleTypeToDomainCategory("playground")).toBe("playground");
  });

  // Landmark aggregation
  it("maps church → landmark", () => {
    expect(googleTypeToDomainCategory("church")).toBe("landmark");
  });

  it("maps historical_landmark → landmark", () => {
    expect(googleTypeToDomainCategory("historical_landmark")).toBe("landmark");
  });

  it("maps tourist_attraction → landmark", () => {
    expect(googleTypeToDomainCategory("tourist_attraction")).toBe("landmark");
  });

  it("maps train_station → landmark", () => {
    expect(googleTypeToDomainCategory("train_station")).toBe("landmark");
  });

  // Unknown / fallback
  it("returns 'other' for unknown Google type", () => {
    expect(googleTypeToDomainCategory("zorbing_arena")).toBe("other");
  });

  it("returns 'other' for empty string", () => {
    expect(googleTypeToDomainCategory("")).toBe("other");
  });
});

describe("domainCategoryToGoogleTypes", () => {
  it("maps park → multiple Google types", () => {
    const types = domainCategoryToGoogleTypes("park");
    expect(types).toContain("park");
    expect(types).toContain("national_park");
    expect(types).toContain("dog_park");
  });

  it("maps cafe → cafe and coffee_shop", () => {
    const types = domainCategoryToGoogleTypes("cafe");
    expect(types).toContain("cafe");
    expect(types).toContain("coffee_shop");
    expect(types).toContain("ice_cream_shop");
  });

  it("maps store → many store types", () => {
    const types = domainCategoryToGoogleTypes("store");
    expect(types).toContain("store");
    expect(types).toContain("book_store");
    expect(types).toContain("clothing_store");
    expect(types).toContain("shopping_mall");
  });

  it("maps school → school, university, primary_school, secondary_school", () => {
    const types = domainCategoryToGoogleTypes("school");
    expect(types).toContain("school");
    expect(types).toContain("university");
  });

  it("maps gym → gym, fitness_center, sports_complex, swimming_pool", () => {
    const types = domainCategoryToGoogleTypes("gym");
    expect(types).toContain("gym");
    expect(types).toContain("fitness_center");
  });

  it("returns the category name for unmapped domain categories", () => {
    const types = domainCategoryToGoogleTypes("fountain");
    expect(types).toEqual(["fountain"]);
  });

  it("returns the category name for 'other'", () => {
    const types = domainCategoryToGoogleTypes("other");
    expect(types).toEqual(["other"]);
  });
});
