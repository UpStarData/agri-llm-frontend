import type { GeoPointKind } from "@/api/fact";

/** 叠加数据图层的全部类型，默认全选。 */
export const GEO_POINT_KINDS: GeoPointKind[] = [
  "region",
  "port",
  "airport",
  "market",
  "risk",
];

/**
 * 叠加点位是否可用，只看左侧「区域筛选」选中的区域。
 * 地图取景（放大缩小、点击下钻）不改变业务数据，因此不能用地图层级判断：
 * 地缘风险区只有全球视角有点位，港口在省级视角下不展示。
 */
export const geoPointKindAvailable = (
  kind: GeoPointKind,
  countryId: string,
  provinceId: string,
) => {
  if (kind === "risk") return !countryId;
  if (kind === "port") return !provinceId;
  return true;
};
