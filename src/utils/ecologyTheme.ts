import type { Entity } from "@/types";

/** 亮色主题唯一色值来源；CSS、Ant Design、deck.gl 和图表共用。 */
export const ECOLOGY_THEME = {
  page: "#F4F8FB",
  panel: "#FFF",
  panelGlass: "color-mix(in srgb, var(--eco-panel) 85%, transparent)",
  card: "#F9FBFD",
  text: "#1F2937",
  muted: "#6B7C93",
  ocean: "#7EC8E8",
  land: "#E6F1D8",
  borderCountry: "#BFD8E6",
  coastline: "#8EC7E0",
  selected: "#7FDCB0",
  route: "#3FB2E7",
  priorityRoute: "#F7A84D",
  production: "#28B463",
  hub: "#008BD9",
  anomaly: "#FF6B6B",
  border: "#E5EAF2",
  routeGreen: "#23865B",
  oceanLight: "#A5DCEE",
  oceanShade: "#69ADC9",
  landPalette: ["#E6F1D8", "#EDEEDB", "#DFEDD5", "#EBF2DF", "#E9E8D7", "#E3EEDC"],
  warningText: "#A55F16",
  anomalyText: "#C64545",
  shadow: "0 4px 18px rgba(31, 41, 55, 0.07)",
  selectedSurface: "rgba(127, 220, 176, 0.16)",
} as const;
export type RGB = [number, number, number];
export const rgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
export const rgba = (hex: string, alpha: number): [number, number, number, number] => [
  ...rgb(hex), alpha,
];
export const ecologyCssVariables = Object.fromEntries(
  Object.entries(ECOLOGY_THEME)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => [`--eco-${key}`, value]),
);

// 分类使用接口已有的 categoryL2/key 或中文名称，不根据关系数量推断枢纽。
export const isLogisticsHub = (entity: Entity) =>
  entity.displayGroup === "port_airport" || /^(port|airport|logistics_hub|logistics_center|warehouse|港口|机场|物流枢纽|物流中心|仓储|仓库)$/.test(entity.type);
export const entityThemeColor = (entity: Entity): string =>
  (entity.displayGroup === "geo_risk" || /^(risk|risk_event|异常|风险|风险事件|地缘风险区)$/.test(entity.type))
    ? ECOLOGY_THEME.anomaly
    : isLogisticsHub(entity)
      ? ECOLOGY_THEME.hub
      : (entity.displayGroup === "market" || /^(market|wholesale_market|市场|批发市场)$/.test(entity.type))
        ? ECOLOGY_THEME.priorityRoute
        : entity.displayGroup && !["production_base", "variety"].includes(entity.displayGroup)
          ? ECOLOGY_THEME.route
          : ECOLOGY_THEME.production;

export const geoThemeColor = (kind: string): string => {
  switch (kind) {
    case "port":
    case "airport": return ECOLOGY_THEME.hub;
    case "market": return ECOLOGY_THEME.priorityRoute;
    case "risk": return ECOLOGY_THEME.anomaly;
    default: return ECOLOGY_THEME.production;
  }
};
