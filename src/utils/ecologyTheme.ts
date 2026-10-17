import type { FactTaxonomyGroup } from "@/api/fact";
import type { EntityCategoryCatalog } from "@/api/relation";
import type { Entity } from "@/types";

/** 亮色主题唯一色值来源；CSS、Ant Design、deck.gl 和图表共用。 */
export const ECOLOGY_THEME = {
  // 事实、关联地图与筛选图例共用；替换分类色只修改这里。
  categoryNature: "#4DDBA7",
  categoryProduction: "#FFD166",
  categoryLogistics: "#69B8FF",
  categoryMarket: "#FFA75C",
  categoryConsumption: "#F497C1",
  categoryPolicy: "#B49AF2",
  categoryEvent: "#FF8B91",
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
  // 未分类事实使用中性色；已分类事实按七大类取色。
  factPoint: "#6B7C93",
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
/** 大类色板集中维护，分类树顺序和 UUID 变化不影响颜色。 */
export const FACT_CATEGORY_COLORS: Record<string, string> = {
  "自然与生态": ECOLOGY_THEME.categoryNature,
  "生产与供给": ECOLOGY_THEME.categoryProduction,
  "流通与供应链": ECOLOGY_THEME.categoryLogistics,
  "市场与交易": ECOLOGY_THEME.categoryMarket,
  "消费与舆情": ECOLOGY_THEME.categoryConsumption,
  "政策与治理": ECOLOGY_THEME.categoryPolicy,
  "宏观与公共事件": ECOLOGY_THEME.categoryEvent,
};

/** 只做颜色查表，不改变接口记录与分类筛选结果。 */
export const factCategoryColors = (groups: FactTaxonomyGroup[]) => {
  const colors = new Map<string, RGB>();
  for (const group of groups) {
    const color = rgb(FACT_CATEGORY_COLORS[group.name] ?? ECOLOGY_THEME.factPoint);
    colors.set(group.id, color);
    for (const category of group.categories) {
      colors.set(category.id, color);
      for (const type of category.types) colors.set(type.id, color);
    }
  }
  return colors;
};

// /entity-categories 实际返回的一级分类 ID；不从名称、displayGroup 或 UUID 内容推断。
const ENTITY_CATEGORY_COLORS: Record<string, string> = {
  "01a11fc7-fcee-7033-8584-5e7ed760b5a7": ECOLOGY_THEME.categoryLogistics, // 地理与设施
  "01a11fc7-fcee-7033-8584-5e8567be2315": ECOLOGY_THEME.categoryPolicy, // 主体与组织
  "01a11fc7-fcee-7033-8584-5e89a7a82eac": ECOLOGY_THEME.categoryNature, // 农作物
  "01a11fc7-fcee-7033-8584-5e90db4461bf": ECOLOGY_THEME.categoryEvent, // 事件
};

/** 由接口分类树将一级分类颜色传给子分类，仅用于展示。 */
export const entityCategoryColors = (catalog?: EntityCategoryCatalog) => {
  const colors = new Map<string, RGB>();
  for (const group of catalog?.categories ?? []) {
    const color = rgb(ENTITY_CATEGORY_COLORS[group.id] ?? ECOLOGY_THEME.factPoint);
    colors.set(group.id, color);
    for (const category of group.children) colors.set(category.id, color);
  }
  return colors;
};

/** 热度仅控制透明度：0 保留 40% 可见度，100/缺省为完全不透明。 */
export const factIntensityColor = (
  intensity?: number,
  base: RGB = rgb(ECOLOGY_THEME.factPoint),
): [number, number, number, number] => {
  const heat = Number.isFinite(intensity) ? Math.min(100, Math.max(0, intensity ?? 100)) / 100 : 1;
  return [...base, Math.round(255 * (0.4 + 0.6 * heat))];
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
