import type { Position } from "../types";

export const EARTH_RADIUS_KM = 6371.0088;

/**
 * Great-circle destinations, keeping longitudes continuous across the dateline.
 * 段数由调用方按屏幕尺寸决定：影响圆常常只有几像素，固定 96 段会让几百个点挤在一起反复重切。
 */
export function impactCircle(center: Position, radiusKm: number, segments = 96): Position[] {
  const [longitude, latitude] = center.map((value) => value * Math.PI / 180);
  const arc = radiusKm / EARTH_RADIUS_KM;
  const count = Math.max(3, Math.round(segments));
  let previous = center[0];
  return Array.from({ length: count + 1 }, (_, index) => {
    const bearing = index / count * Math.PI * 2;
    const lat = Math.asin(Math.sin(latitude) * Math.cos(arc) +
      Math.cos(latitude) * Math.sin(arc) * Math.cos(bearing));
    const lon = longitude + Math.atan2(Math.sin(bearing) * Math.sin(arc) * Math.cos(latitude),
      Math.cos(arc) - Math.sin(latitude) * Math.sin(lat));
    let degrees = lon * 180 / Math.PI;
    while (degrees - previous > 180) degrees -= 360;
    while (degrees - previous < -180) degrees += 360;
    previous = degrees;
    return [degrees, lat * 180 / Math.PI];
  });
}

/** 两点间的大圆距离（公里）。 */
export function distanceKm(from: Position, to: Position): number {
  const radians = Math.PI / 180;
  const deltaLatitude = (to[1] - from[1]) * radians;
  const deltaLongitude = (to[0] - from[0]) * radians;
  const a = Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(from[1] * radians) * Math.cos(to[1] * radians) *
    Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 视图中心每像素对应的公里数。球体与平面在低缩放下共用同一套近似，
 * 只用来按屏幕尺寸决定采样密度，不需要逐点精确。
 */
export function getKmPerPixel(zoom: number, latitude: number): number {
  return 2 * Math.PI * EARTH_RADIUS_KM *
    Math.max(Math.cos(latitude * Math.PI / 180), 0.01) / (512 * 2 ** zoom);
}

/** Local horizontal scale at the center of the flat map. */
export function mapScale(zoom: number, latitude: number, _flatWorld: boolean) {
  const kmPerPixel = getKmPerPixel(zoom, latitude);
  const maximum = kmPerPixel * 100;
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const distance = [5, 2, 1].map((n) => n * magnitude).find((n) => n <= maximum) ?? magnitude;
  return { pixels: distance / kmPerPixel, label: distance >= 1 ? `${distance} 千米` : `${Math.round(distance * 1000)} 米` };
}
