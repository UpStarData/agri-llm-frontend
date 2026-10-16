import { create } from "zustand";
import { readTheme, saveTheme } from "./utils/theme";
import { GEO_POINT_KINDS } from "./utils/geoPointKinds";
import type { RelationContext } from "./api/relation";
import dayjs, { DISPLAY_TIMEZONE } from "./utils/date";
import type {
  ColorTheme,
  MapLevel,
  MapOverlayType,
  Mode,
  Selection,
} from "./types";
import type { GeoPointKind } from "./api/fact";

type DrawerSide = "left" | "right" | "bottom";

interface IFactFilters {
  // 与 /commodities 返回的 id 一致，事实层和关联层共用。
  varieties: string[];
  countryId: string;
  provinceId: string;
  keyword: string;
  videoOnly: boolean;
}

interface IModeState {
  level: MapLevel;
  regionId?: string;
  selection: Selection | null;
  detailsOpen: boolean;
  detailStack: Selection[];
  highlightedEntityId: string | null;
}
interface DashboardState {
  mode: Mode;
  modeStates: Record<Mode, IModeState>;
  recordScroll: Record<Mode, number>;
  setRecordScroll: (mode: Mode, top: number) => void;
  detailStack: Selection[];
  highlightedEntityId: string | null;
  relationFilters: {
    keyword: string;
    excludedTypes: string[];
    crossRegion: boolean;
  };
  relationContext: RelationContext | null;
  relationRevision: number;
  relationGlow: { entityIds: string[]; relationIds: string[]; until: number };
  glowRelation: (entityIds: string[], relationIds: string[]) => void;
  enterRelation: (context: RelationContext) => void;
  exitRelationContext: () => void;
  refreshRelationContext: () => void;
  setRelationFilters: (
    filters: Partial<DashboardState["relationFilters"]>,
  ) => void;
  setHighlightedEntity: (id: string | null) => void;
  pushDetail: (selection: Selection) => void;
  backDetail: () => void;
  level: MapLevel;
  regionId?: string;
  dateRange: [string, string] | null;
  selection: Selection | null;
  detailsOpen: boolean;
  colorTheme: ColorTheme;
  drawerOpen: Record<Mode, Record<DrawerSide, boolean>>;
  excludedFilterIds: Record<Mode, string[]>;
  mapOverlayVisibility: Record<MapOverlayType, boolean>;
  factGeoKinds: GeoPointKind[];
  mapControlsVisible: boolean;
  setMapControlsVisible: (enabled: boolean) => void;
  factFilters: IFactFilters;
  setFactFilters: (filters: Partial<IFactFilters>) => void;
  setFactRegion: (countryId: string, provinceId?: string) => void;
  togglePanel: (side: DrawerSide) => void;
  setMode: (mode: Mode) => void;
  setRegion: (level: MapLevel, regionId?: string) => void;
  setDateRange: (range: [string, string] | null) => void;
  select: (selection: Selection | null) => void;
  setDetailsOpen: (open: boolean) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setDrawerOpen: (mode: Mode, side: DrawerSide, open: boolean) => void;
  setExcludedFilterIds: (mode: Mode, ids: string[]) => void;
  setMapOverlayVisibility: (type: MapOverlayType, visible: boolean) => void;
  setFactGeoKinds: (kinds: GeoPointKind[]) => void;
}
const modeState = (): IModeState => ({
  level: "world",
  regionId: undefined,
  selection: null,
  detailsOpen: false,
  detailStack: [],
  highlightedEntityId: null,
});
const captureMode = (s: DashboardState): IModeState => ({
  level: s.level,
  regionId: s.regionId,
  selection: s.selection,
  detailsOpen: s.detailsOpen,
  detailStack: s.detailStack,
  highlightedEntityId: s.highlightedEntityId,
});
// 详情栈里最后一个本体详情决定地图高亮。
const lastEntityId = (stack: Selection[]): string | null =>
  stack.filter((item) => item.kind === "entity").at(-1)?.id ?? null;
const today = dayjs().tz(DISPLAY_TIMEZONE);
export const useDashboardStore = create<DashboardState>((set) => ({
  mode: "fact",
  modeStates: { fact: modeState(), relation: modeState() },
  recordScroll: { fact: 0, relation: 0 },
  setRecordScroll: (mode, top) =>
    set((s) => ({ recordScroll: { ...s.recordScroll, [mode]: top } })),
  detailStack: [],
  highlightedEntityId: null,
  relationFilters: { keyword: "", excludedTypes: [], crossRegion: true },
  relationContext: null,
  relationRevision: 0,
  relationGlow: { entityIds: [], relationIds: [], until: 0 },
  glowRelation: (entityIds, relationIds) =>
    set({ relationGlow: { entityIds, relationIds, until: Date.now() + 3000 } }),
  enterRelation: (relationContext) =>
    set((s) => ({
      modeStates: { ...s.modeStates, [s.mode]: captureMode(s) },
      ...s.modeStates.relation,
      mode: "relation",
      relationContext,
      relationRevision:
        s.relationRevision +
        Number(
          relationContext.factId !== s.relationContext?.factId ||
            relationContext.rootEntityId !== s.relationContext?.rootEntityId,
        ),
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    })),
  exitRelationContext: () =>
    set({
      relationContext: null,
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    }),
  refreshRelationContext: () =>
    set((s) => ({
      relationRevision: s.relationRevision + 1,
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    })),
  setRelationFilters: (filters) =>
    set((s) => ({
      relationFilters: { ...s.relationFilters, ...filters },
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    })),
  setHighlightedEntity: (highlightedEntityId) => set({ highlightedEntityId }),
  pushDetail: (selection) =>
    set((s) => {
      // 同类详情只保留一个：重新打开同类详情时，把它之后的钻取层级一并关掉。
      const sameKind = s.detailStack.findIndex(
        (item) => item.kind === selection.kind,
      );
      const base =
        sameKind === -1 ? s.detailStack : s.detailStack.slice(0, sameKind);
      // 详情区最多并排展示两个，更早的详情退出。
      const detailStack = [...base, selection].slice(-2);
      return {
        selection,
        detailsOpen: true,
        detailStack,
        highlightedEntityId: lastEntityId(detailStack),
      };
    }),
  backDetail: () =>
    set((s) => {
      const detailStack = s.detailStack.slice(0, -1);
      const selection = detailStack.at(-1) ?? null;
      return {
        detailStack,
        selection,
        detailsOpen: detailStack.length > 0,
        highlightedEntityId: lastEntityId(detailStack),
      };
    }),
  level: "world",
  dateRange: [
    today.subtract(29, "day").format("YYYY-MM-DD"),
    today.format("YYYY-MM-DD"),
  ],
  selection: null,
  detailsOpen: false,
  colorTheme: readTheme(),
  drawerOpen: {
    fact: { left: true, right: true, bottom: false },
    relation: { left: true, right: true, bottom: false },
  },
  excludedFilterIds: { fact: [], relation: [] },
  mapOverlayVisibility: { ports: false, factSources: false, influence: false },
  // 叠加数据图层默认全选。
  factGeoKinds: [...GEO_POINT_KINDS],
  mapControlsVisible: true,
  setMapControlsVisible: (mapControlsVisible) => set({ mapControlsVisible }),
  factFilters: {
    varieties: [],
    countryId: "",
    provinceId: "",
    keyword: "",
    videoOnly: false,
  },
  setFactFilters: (filters) =>
    set((state) => {
      const varietyChanged =
        filters.varieties !== undefined &&
        JSON.stringify(filters.varieties) !==
          JSON.stringify(state.factFilters.varieties);
      return {
        factFilters: { ...state.factFilters, ...filters },
        selection: null,
        detailsOpen: false,
        detailStack: [],
        highlightedEntityId: null,
        relationRevision: state.relationRevision + Number(varietyChanged),
        recordScroll: varietyChanged
          ? { fact: 0, relation: 0 }
          : { ...state.recordScroll, fact: 0 },
        modeStates: varietyChanged
          ? {
              fact: {
                ...state.modeStates.fact,
                selection: null,
                detailsOpen: false,
                detailStack: [],
                highlightedEntityId: null,
              },
              relation: {
                ...state.modeStates.relation,
                selection: null,
                detailsOpen: false,
                detailStack: [],
                highlightedEntityId: null,
              },
            }
          : state.modeStates,
      };
    }),
  // 左侧「区域筛选」：只换业务筛选条件（列表、地图星点、叠加点位、实时订阅）并清掉过期详情。
  // 地图取景由地图自己的点击与缩放决定，切区域不移动地图。
  setFactRegion: (countryId, provinceId = "") =>
    set((state) => ({
      factFilters: { ...state.factFilters, countryId, provinceId },
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    })),
  togglePanel: (side) =>
    set((state) => ({
      drawerOpen: {
        ...state.drawerOpen,
        [state.mode]: {
          ...state.drawerOpen[state.mode],
          [side]: !state.drawerOpen[state.mode][side],
        },
      },
    })),
  setMode: (mode) =>
    set((s) =>
      s.mode === mode
        ? {}
        : {
            modeStates: { ...s.modeStates, [s.mode]: captureMode(s) },
            ...s.modeStates[mode],
            mode,
          },
    ),
  // 地图点击/缩放的取景切换：只改地图，不动卡片筛选条件。
  setRegion: (level, regionId) =>
    set({
      level,
      regionId,
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    }),
  setDateRange: (dateRange) =>
    set({
      dateRange,
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    }),
  select: (selection) =>
    set((s) => ({
      selection,
      detailsOpen: selection !== null,
      detailStack: selection ? [selection] : [],
      highlightedEntityId:
        s.mode === "relation" && selection?.kind === "entity"
          ? selection.id
          : null,
    })),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  setColorTheme: (colorTheme) => {
    saveTheme(colorTheme);
    set({ colorTheme });
  },
  setDrawerOpen: (mode, side, open) =>
    set((state) => ({
      drawerOpen: {
        ...state.drawerOpen,
        [mode]: { ...state.drawerOpen[mode], [side]: open },
      },
    })),
  setExcludedFilterIds: (mode, ids) =>
    set((state) => ({
      excludedFilterIds: { ...state.excludedFilterIds, [mode]: ids },
      selection: null,
      detailsOpen: false,
      detailStack: [],
      highlightedEntityId: null,
    })),
  setMapOverlayVisibility: (type, visible) =>
    set((state) => ({
      mapOverlayVisibility: { ...state.mapOverlayVisibility, [type]: visible },
    })),
  setFactGeoKinds: (factGeoKinds) => set({ factGeoKinds }),
}));
