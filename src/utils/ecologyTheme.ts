import type { Entity } from "@/types";

/** 亮色主题唯一色值来源；CSS、Ant Design、deck.gl 和图表共用。 */
export const ECOLOGY_THEME = {
  page: "#F4F8FB",
  panel: "#FFF",
  panelGlass: "color-mix(in srgb, var(--eco-panel) 85%, transparent)",
  card: "#F9FBFD",
  text: "#1F2937",
  muted: "#6B7C93",
  ocean: "#5FBDF2",
  land: "#CFE9BD",
  borderCountry: "#E08076",
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
  // 相邻区域异色的分区色板（见 utils/regionColoring.ts）。整体低饱和、明亮柔和，
  // 填色不透明；分配时会保证相邻区域取到不同颜色。
  landPalette: [
    "#CFE9BD",
    "#E2EFC6",
    "#B6DFA4",
    "#EAE7C4",
    "#C9E6CD",
    "#D7E4B2",
    "#BCDCC9",
    "#E8F0D8",
  ],
  // 悬停填色。按规格与色板里的「柔和绿」同值，因此分到该色的区域悬停时填色不变。
  landHover: "#B6DFA4",
  // 事实星点的热度色标（见 factIntensityColor）：满热度用星点主题色，低热度向灰收敛。
  factPoint: "#FFFFFF",
  factPointLow: "#6B7C93",
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
/**
 * 事实星点按热度着色：intensity 0–100，越低越接近灰色，缺省时保留星点主题色。
 * 越界值按边界处理，同一个热度在任何数据下都得到同一种颜色。
 */
export const factIntensityColor = (intensity?: number): RGB => {
  const base = rgb(ECOLOGY_THEME.factPoint);
  if (!Number.isFinite(intensity)) return base;
  const low = rgb(ECOLOGY_THEME.factPointLow);
  const heat = Math.min(100, Math.max(0, intensity ?? 0)) / 100;
  const mix = (channel: number, index: number) =>
    Math.round(channel + (base[index] - channel) * heat);
  return [mix(low[0], 0), mix(low[1], 1), mix(low[2], 2)];
};
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
