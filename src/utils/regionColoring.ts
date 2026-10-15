import type { Boundaries } from "@/types";

/**
 * 相邻判定半径（度，约 2km）。世界边界由同一份拓扑切出，邻国会共享顶点，
 * 取这个量级既能识别共享边，又不会把直布罗陀、白令海峡这类窄水道两岸算成相邻。
 */
const NEIGHBOR_DISTANCE = 0.02;

/** 边界数据里 regionId 既可能是字符串也可能是数字，统一成字符串做键。 */
const regionIdOf = (regionId: string | number | undefined) =>
  regionId === undefined || regionId === null ? undefined : String(regionId);

function collectPositions(geometry: Boundaries["features"][number]["geometry"]): [number, number][] {
  const positions: [number, number][] = [];
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number")
      positions.push([node[0], node[1]]);
    else for (const child of node) walk(child);
  };
  walk(geometry.coordinates);
  return positions;
}

/**
 * 按边界几何贪心着色：默认在整块色板上均匀铺开，同时保证相邻区域取到不同颜色。
 * 结果只取决于边界数据与色板长度，用 WeakMap 缓存，相机和图层重建不会重复计算。
 */
const indexCache = new WeakMap<Boundaries, Map<number, Map<string, number>>>();

export function regionColorIndices(
  boundaries: Boundaries | undefined,
  paletteSize: number,
): Map<string, number> {
  if (!boundaries?.features.length || paletteSize < 1) return new Map();
  const cache = indexCache.get(boundaries) ?? new Map<number, Map<string, number>>();
  indexCache.set(boundaries, cache);
  const cached = cache.get(paletteSize);
  if (cached) return cached;
  const computed = colorRegions(boundaries, paletteSize);
  cache.set(paletteSize, computed);
  return computed;
}

function colorRegions(boundaries: Boundaries, paletteSize: number): Map<string, number> {
  // 同一个 regionId 可能出现多次（例如数据里的 -99 占位），按区域合并顶点，它们必然同色。
  const positions = new Map<string, [number, number][]>();
  const order: string[] = [];
  for (const feature of boundaries.features) {
    const regionId = regionIdOf(feature.properties?.regionId);
    if (regionId === undefined) continue;
    const collected = collectPositions(feature.geometry);
    const existing = positions.get(regionId);
    if (existing) existing.push(...collected);
    else {
      positions.set(regionId, collected);
      order.push(regionId);
    }
  }
  // 顶点装进格网，避免 O(n²) 的两两比对。
  const grid = new Map<string, [string, number, number][]>();
  const cellOf = (value: number) => Math.floor(value / NEIGHBOR_DISTANCE);
  for (const regionId of order)
    for (const [longitude, latitude] of positions.get(regionId)!) {
      const key = `${cellOf(longitude)},${cellOf(latitude)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push([regionId, longitude, latitude]);
      else grid.set(key, [[regionId, longitude, latitude]]);
    }

  const neighbors = new Map(order.map((regionId) => [regionId, new Set<string>()]));
  for (const regionId of order)
    for (const [longitude, latitude] of positions.get(regionId)!) {
      const column = cellOf(longitude);
      const row = cellOf(latitude);
      for (let dx = -1; dx <= 1; dx += 1)
        for (let dy = -1; dy <= 1; dy += 1)
          for (const [other, otherLongitude, otherLatitude] of
            grid.get(`${column + dx},${row + dy}`) ?? [])
            if (
              other !== regionId &&
              Math.hypot(otherLongitude - longitude, otherLatitude - latitude) <= NEIGHBOR_DISTANCE
            )
              neighbors.get(regionId)!.add(other);
    }

  // Welsh–Powell 排序：邻居多的先着色，顺序固定以保证同一份数据每次都得到同样的配色。
  const firstSeen = new Map(order.map((regionId, index) => [regionId, index]));
  const ranked = [...order].sort(
    (a, b) =>
      neighbors.get(b)!.size - neighbors.get(a)!.size ||
      firstSeen.get(a)! - firstSeen.get(b)!,
  );
  const color = new Map<string, number>();
  const usage = new Array(paletteSize).fill(0);
  for (const regionId of ranked) {
    const taken = new Set<number>();
    for (const other of neighbors.get(regionId)!) {
      const assigned = color.get(other);
      if (assigned !== undefined) taken.add(assigned);
    }
    let chosen = -1;
    for (let index = 0; index < paletteSize; index += 1)
      if (!taken.has(index) && (chosen < 0 || usage[index] < usage[chosen]))
        chosen = index;
    if (chosen < 0) {
      // 邻居占满整块色板（色板不够用）时退化为冲突最少的一种，而不是留空。
      const conflicts = new Array(paletteSize).fill(0);
      for (const other of neighbors.get(regionId)!) {
        const assigned = color.get(other);
        if (assigned !== undefined) conflicts[assigned] += 1;
      }
      chosen = conflicts.indexOf(Math.min(...conflicts));
    }
    color.set(regionId, chosen);
    usage[chosen] += 1;
  }
  return color;
}
