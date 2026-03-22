/** Default geofence radius for target pass detection (meters) */
export const DEFAULT_GEOFENCE_RADIUS_METERS = 30;

/** Maximum plausible running speed (m/s). ~27 mph covers elite sprinters. */
export const MAX_RUNNING_SPEED_MS = 12;

/** Minimum time between GPS samples to consider valid (ms) */
export const MIN_GPS_INTERVAL_MS = 500;

/** GPS accuracy above this threshold is considered unreliable (meters) */
export const GPS_ACCURACY_THRESHOLD_METERS = 50;

/** Number of recent points used for GPS jitter smoothing */
export const GPS_SMOOTHING_WINDOW = 3;

/** Maximum GPS points per ingestion batch */
export const MAX_BATCH_SIZE = 50;

/** Earth radius in meters (WGS84 mean) */
export const EARTH_RADIUS_METERS = 6_371_008.8;
