import { describe, it, expect } from "vitest";
import {
  checkProximity,
  findFirstGeofenceCrossing,
} from "@/domain/location/geofence";
import type { Coordinates } from "@/domain/location/location-sample";
import { ADAMS_POINT_CENTER, LAKE_MERRITT_PERGOLA } from "@tests/fixtures/factories";

describe("checkProximity", () => {
  it("detects player within geofence", () => {
    // Two points 5 meters apart
    const player: Coordinates = { latitude: 37.81050, longitude: -122.25340 };
    const target: Coordinates = { latitude: 37.81054, longitude: -122.25340 };
    const result = checkProximity(player, target, 30);
    expect(result.isWithinGeofence).toBe(true);
    expect(result.distanceMeters).toBeLessThan(30);
  });

  it("detects player outside geofence", () => {
    const result = checkProximity(ADAMS_POINT_CENTER, LAKE_MERRITT_PERGOLA, 30);
    expect(result.isWithinGeofence).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(30);
  });

  it("returns correct bearing", () => {
    const north: Coordinates = { latitude: 37.0, longitude: -122.0 };
    const south: Coordinates = { latitude: 36.999, longitude: -122.0 };
    const result = checkProximity(north, south, 10000);
    expect(result.bearing).toBeCloseTo(180, 0);
  });

  it("boundary: exactly at radius is within geofence", () => {
    // Same point, radius 0
    const point: Coordinates = { latitude: 37.8105, longitude: -122.2534 };
    const result = checkProximity(point, point, 0);
    expect(result.isWithinGeofence).toBe(true);
    expect(result.distanceMeters).toBeCloseTo(0, 1);
  });
});

describe("findFirstGeofenceCrossing", () => {
  const target: Coordinates = { latitude: 37.81050, longitude: -122.25340 };

  it("returns -1 when no points cross", () => {
    const farAway: Coordinates[] = [
      { latitude: 38.0, longitude: -122.0 },
      { latitude: 38.1, longitude: -122.0 },
    ];
    expect(findFirstGeofenceCrossing(farAway, target, 30)).toBe(-1);
  });

  it("returns index of first crossing point", () => {
    const points: Coordinates[] = [
      { latitude: 38.0, longitude: -122.0 },       // far
      { latitude: 37.81052, longitude: -122.25341 }, // within 30m
      { latitude: 37.81050, longitude: -122.25340 }, // exact
    ];
    expect(findFirstGeofenceCrossing(points, target, 30)).toBe(1);
  });

  it("returns 0 when first point is already inside", () => {
    const points: Coordinates[] = [
      { latitude: 37.81050, longitude: -122.25340 },
    ];
    expect(findFirstGeofenceCrossing(points, target, 30)).toBe(0);
  });

  it("handles empty array", () => {
    expect(findFirstGeofenceCrossing([], target, 30)).toBe(-1);
  });
});
