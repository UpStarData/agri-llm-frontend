import type { FactPoint } from "@/api/fact";
import type { Position } from "@/types";

/** 仅展开同坐标事实的显示位置，原始坐标仍用于详情、提示和影响范围。 */
export function layoutFactPoints(
  points: FactPoint[],
  project: (position: number[]) => number[],
  unproject: (position: number[]) => number[],
  canSpread: (position: Position) => boolean = () => true,
  pointScale = 1,
): Map<FactPoint, Position> {
  const groups = new Map<string, FactPoint[]>();
  for (const point of points) {
    const key = point.geoPoint.join(",");
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }
  const positions = new Map<FactPoint, Position>();
  for (const group of groups.values()) {
    if (group.length < 2 || !canSpread(group[0].geoPoint)) continue;
    const [x, y] = project(group[0].geoPoint);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    [...group].sort((a, b) => a.factId.localeCompare(b.factId)).forEach((point, index) => {
      const radius = 7 * pointScale * Math.sqrt(index);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      const position = unproject([x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
      if (position.slice(0, 2).every(Number.isFinite))
        positions.set(point, [position[0], position[1]]);
    });
  }
  return positions;
}
