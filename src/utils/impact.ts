import type { Position } from "../types";

export const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle destinations, keeping longitudes continuous across the dateline. */
export function impactCircle(center: Position, radiusKm: number): Position[] {
  const [longitude, latitude] = center.map((value) => value * Math.PI / 180);
  const arc = radiusKm / EARTH_RADIUS_KM;
  let previous = center[0];
  return Array.from({ length: 97 }, (_, index) => {
    const bearing = index / 96 * Math.PI * 2;
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

/** Local horizontal scale at the center of the flat map. */
export function mapScale(zoom: number, latitude: number, flatWorld: boolean) {
  const realLatitude = flatWorld
    ? Math.asinh(Math.tan(latitude * Math.PI / 180)) * 180 / Math.PI
    : latitude;
  const kmPerPixel = 2 * Math.PI * EARTH_RADIUS_KM * Math.cos(realLatitude * Math.PI / 180) /
    (512 * 2 ** zoom);
  const maximum = kmPerPixel * 100;
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const distance = [5, 2, 1].map((n) => n * magnitude).find((n) => n <= maximum) ?? magnitude;
  return { pixels: distance / kmPerPixel, label: distance >= 1 ? `${distance} 千米` : `${Math.round(distance * 1000)} 米` };
}
