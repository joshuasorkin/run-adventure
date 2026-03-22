import { describe, it, expect } from "vitest";
import { checkVelocity } from "@/domain/location/velocity-check";

describe("checkVelocity", () => {
  it("accepts normal walking speed (~1.4 m/s)", () => {
    const prev = {
      latitude: 37.8105,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:00Z"),
    };
    // ~14 meters north (≈ 0.000126 degrees)
    const curr = {
      latitude: 37.81063,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:10Z"), // 10 seconds later
    };
    const result = checkVelocity(prev, curr);
    expect(result.isValid).toBe(true);
    expect(result.speedMs).toBeLessThan(3);
  });

  it("accepts fast running speed (~5 m/s)", () => {
    const prev = {
      latitude: 37.8105,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:00Z"),
    };
    // ~50 meters north
    const curr = {
      latitude: 37.81095,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:10Z"),
    };
    const result = checkVelocity(prev, curr);
    expect(result.isValid).toBe(true);
    expect(result.speedMs).toBeLessThan(12);
  });

  it("rejects teleportation (impossible speed)", () => {
    const prev = {
      latitude: 37.8105,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:00Z"),
    };
    // SF to Oakland in 1 second
    const curr = {
      latitude: 37.8044,
      longitude: -122.2712,
      timestamp: new Date("2025-06-15T10:00:01Z"),
    };
    const result = checkVelocity(prev, curr);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("exceeds_max_speed");
  });

  it("rejects points too close in time", () => {
    const prev = {
      latitude: 37.8105,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:00.000Z"),
    };
    const curr = {
      latitude: 37.81051,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:00.100Z"), // 100ms later
    };
    const result = checkVelocity(prev, curr);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("points_too_close_in_time");
  });

  it("respects custom maxSpeedMs parameter", () => {
    const prev = {
      latitude: 37.8105,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:00Z"),
    };
    const curr = {
      latitude: 37.81095,
      longitude: -122.2534,
      timestamp: new Date("2025-06-15T10:00:10Z"),
    };
    // Normal running speed (~5 m/s) should fail with strict 2 m/s limit
    const result = checkVelocity(prev, curr, 2);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("exceeds_max_speed");
  });
});
