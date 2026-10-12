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

// 分类只用接口随行下发的 displayGroup（9 值枚举）；entity.type 为分类 UUID，无语义可判。
export const isLogisticsHub = (entity: Entity) =>
  entity.displayGroup === "port_airport";
export const entityThemeColor = (entity: Entity): string =>
  entity.displayGroup === "geo_risk"
    ? ECOLOGY_THEME.anomaly
    : isLogisticsHub(entity)
      ? ECOLOGY_THEME.hub
      : entity.displayGroup === "market"
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
