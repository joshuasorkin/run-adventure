import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  calculateBearing,
  smoothGpsJitter,
} from "@/domain/location/geo";
import type { Coordinates } from "@/domain/location/location-sample";

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    const point: Coordinates = { latitude: 37.8105, longitude: -122.2534 };
    expect(haversineDistance(point, point)).toBeCloseTo(0, 1);
  });

  it("calculates known distance: Adams Point to Lake Merritt Pergola (~280m)", () => {
    const adamsPoint: Coordinates = { latitude: 37.8105, longitude: -122.2534 };
    const pergola: Coordinates = { latitude: 37.8092, longitude: -122.2558 };
    const distance = haversineDistance(adamsPoint, pergola);
    // Should be approximately 250-320m
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(400);
  });

  it("calculates known distance: SF to Oakland (~13km)", () => {
    const sf: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
    const oakland: Coordinates = { latitude: 37.8044, longitude: -122.2712 };
    const distance = haversineDistance(sf, oakland);
    // Should be approximately 13-14km
    expect(distance).toBeGreaterThan(12_000);
    expect(distance).toBeLessThan(15_000);
  });

  it("is symmetric", () => {
    const a: Coordinates = { latitude: 37.8105, longitude: -122.2534 };
    const b: Coordinates = { latitude: 37.8092, longitude: -122.2558 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 6);
  });

  it("handles equator crossing", () => {
    const north: Coordinates = { latitude: 1, longitude: 0 };
    const south: Coordinates = { latitude: -1, longitude: 0 };
    const distance = haversineDistance(north, south);
    // 2 degrees of latitude ≈ 222km
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(224_000);
  });
});

describe("calculateBearing", () => {
  it("returns ~0 for due north", () => {
    const from: Coordinates = { latitude: 37.0, longitude: -122.0 };
    const to: Coordinates = { latitude: 38.0, longitude: -122.0 };
    const bearing = calculateBearing(from, to);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it("returns ~90 for due east", () => {
    const from: Coordinates = { latitude: 37.0, longitude: -122.0 };
    const to: Coordinates = { latitude: 37.0, longitude: -121.0 };
    const bearing = calculateBearing(from, to);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it("returns ~180 for due south", () => {
    const from: Coordinates = { latitude: 38.0, longitude: -122.0 };
    const to: Coordinates = { latitude: 37.0, longitude: -122.0 };
    const bearing = calculateBearing(from, to);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it("returns ~270 for due west", () => {
    const from: Coordinates = { latitude: 37.0, longitude: -121.0 };
    const to: Coordinates = { latitude: 37.0, longitude: -122.0 };
    const bearing = calculateBearing(from, to);
    expect(bearing).toBeCloseTo(270, 0);
  });
});

describe("smoothGpsJitter", () => {
  it("returns empty array for empty input", () => {
    expect(smoothGpsJitter([])).toEqual([]);
  });

  it("returns single point unchanged", () => {
    const point: Coordinates = { latitude: 37.8105, longitude: -122.2534 };
    const result = smoothGpsJitter([point]);
    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBeCloseTo(point.latitude, 8);
    expect(result[0].longitude).toBeCloseTo(point.longitude, 8);
  });

  it("smooths jittery points", () => {
    const points: Coordinates[] = [
      { latitude: 37.81050, longitude: -122.25340 },
      { latitude: 37.81070, longitude: -122.25320 }, // jitter high
      { latitude: 37.81040, longitude: -122.25350 }, // jitter low
      { latitude: 37.81055, longitude: -122.25335 },
      { latitude: 37.81060, longitude: -122.25330 },
    ];

    const smoothed = smoothGpsJitter(points, 3);
    expect(smoothed).toHaveLength(5);

    // The middle point should be pulled closer to the average of its window
    const middleRaw = points[2];
    const middleSmoothed = smoothed[2];
    // Smoothed value should be between the extremes of the window
    expect(middleSmoothed.latitude).toBeGreaterThan(37.8103);
    expect(middleSmoothed.latitude).toBeLessThan(37.8108);
  });

  it("does not mutate input", () => {
    const original: Coordinates = { latitude: 37.8105, longitude: -122.2534 };
    const points = [original];
    smoothGpsJitter(points, 3);
    expect(points[0].latitude).toBe(37.8105);
  });
});
