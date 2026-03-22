/**
 * LocationSample — a single GPS reading from the client device.
 * Pure domain entity. No framework imports.
 */

import type { SessionId } from "@/domain/player/player-session";

export type LocationSampleId = string & { readonly __brand: unique symbol };

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocationSample {
  readonly id: LocationSampleId;
  readonly sessionId: SessionId;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number; // meters
  readonly altitude: number | null;
  readonly speed: number | null; // m/s from device
  readonly heading: number | null; // degrees
  readonly timestamp: Date; // device timestamp
  readonly receivedAt: Date; // server timestamp
}

export function coordsOf(sample: LocationSample): Coordinates {
  return { latitude: sample.latitude, longitude: sample.longitude };
}
