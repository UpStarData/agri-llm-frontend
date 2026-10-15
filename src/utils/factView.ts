import type { FactView } from "../api/fact";
import type { MapLevel } from "../types";

/** 湖南有独立视角，其他省份使用中国视角再按 Province 筛选。 */
export function getFactView(countryId: string, provinceId: string): FactView {
  if (countryId !== "CN") return "global";
  return provinceId === "430000" ? "hunan" : "china";
}

/**
 * 地图取景 → 视角：点击国家、省份只在 level/regionId 上体现，
 * 因此地图星点、叠加点位与关联图谱都由这里推导，和右侧卡片的筛选条件互不影响。
 */
export function getRegionFactView(level: MapLevel, regionId?: string): FactView {
  if (level === "province") return regionId === "430000" ? "hunan" : "china";
  return level === "country" && regionId === "CN" ? "china" : "global";
}
