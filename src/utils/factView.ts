import type { FactView } from "../api/fact";

/** 湖南有独立视角，其他省份使用中国视角再按 Province 筛选。 */
export function getFactView(countryId: string, provinceId: string): FactView {
  if (countryId !== "CN") return "global";
  return provinceId === "430000" ? "hunan" : "china";
}
