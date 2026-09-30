import { create } from "zustand";
import dayjs, { DISPLAY_TIMEZONE } from "./utils/date";
import type { ColorTheme, MapLevel, MapOverlayType, Mode, Selection } from "./types";
import type { GeoPointKind } from "./api/fact";

type DrawerSide = "left" | "right" | "bottom";
type MapControl = "globe" | "fullscreen" | "zoom" | "reset" | "influence" | "video" | "search";

interface IFactFilters {
  varieties: string[];
  countryId: string;
  provinceId: string;
  keyword: string;
  videoOnly: boolean;
}

interface DashboardState {
  mode: Mode;
  level: MapLevel;
  regionId?: string;
  dateRange: [string, string];
  selection: Selection | null;
  detailsOpen: boolean;
  aiOpen: boolean;
  colorTheme: ColorTheme;
  drawerOpen: Record<Mode, Record<DrawerSide, boolean>>;
  excludedFilterIds: Record<Mode, string[]>;
  mapOverlayVisibility: Record<MapOverlayType, boolean>;
  factGeoKinds: GeoPointKind[];
  mapControlVisibility: Record<MapControl, boolean>;
  factFilters: IFactFilters;
  setFactFilters: (filters: Partial<IFactFilters>) => void;
  setFactRegion: (countryId: string, provinceId?: string) => void;
  togglePanel: (side: DrawerSide) => void;
  setMode: (mode: Mode) => void;
  setRegion: (level: MapLevel, regionId?: string) => void;
  setDateRange: (range: [string, string]) => void;
  select: (selection: Selection | null) => void;
  setDetailsOpen: (open: boolean) => void;
  setAiOpen: (open: boolean) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setDrawerOpen: (mode: Mode, side: DrawerSide, open: boolean) => void;
  setExcludedFilterIds: (mode: Mode, ids: string[]) => void;
  setMapOverlayVisibility: (type: MapOverlayType, visible: boolean) => void;
  setFactGeoKinds: (kinds: GeoPointKind[]) => void;
  setMapControlVisibility: (control: MapControl, visible: boolean) => void;
  setAllMapControlVisibility: (visible: boolean) => void;
}
const today = dayjs().tz(DISPLAY_TIMEZONE);
export const useDashboardStore = create<DashboardState>((set) => ({
  mode: "fact",
  level: "world",
  dateRange: [
    today.subtract(29, "day").format("YYYY-MM-DD"),
    today.format("YYYY-MM-DD"),
  ],
  selection: null,
  detailsOpen: false,
  aiOpen: false,
  colorTheme: "dark",
  drawerOpen: {
    fact: { left: true, right: true, bottom: true },
    relation: { left: true, right: true, bottom: false },
  },
  excludedFilterIds: { fact: [], relation: [] },
  mapOverlayVisibility: { ports: false, factSources: false, influence: false },
  factGeoKinds: [],
  mapControlVisibility: { globe: true, fullscreen: true, zoom: true, reset: true, influence: true, video: true, search: true },
  factFilters: { varieties: [], countryId: "", provinceId: "", keyword: "", videoOnly: false },
  setFactFilters: (filters) => set((state) => ({
    factFilters: { ...state.factFilters, ...filters },
    selection: null,
    detailsOpen: false,
  })),
  setFactRegion: (countryId, provinceId = "") => set((state) => ({
    factFilters: { ...state.factFilters, countryId, provinceId },
    level: provinceId ? "province" : countryId ? "country" : "world",
    regionId: provinceId || countryId || undefined,
    selection: null,
    detailsOpen: false,
  })),
  togglePanel: (side) => set((state) => ({
    drawerOpen: {
      ...state.drawerOpen,
      [state.mode]: { ...state.drawerOpen[state.mode], [side]: !state.drawerOpen[state.mode][side] },
    },
  })),
  setMode: (mode) => set({ mode }),
  setRegion: (level, regionId) =>
    set({ level, regionId, selection: null, detailsOpen: false }),
  setDateRange: (dateRange) =>
    set({ dateRange, selection: null, detailsOpen: false }),
  select: (selection) => set({ selection, detailsOpen: selection !== null }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setColorTheme: (colorTheme) => set({ colorTheme }),
  setDrawerOpen: (mode, side, open) => set((state) => ({
    drawerOpen: { ...state.drawerOpen, [mode]: { ...state.drawerOpen[mode], [side]: open } },
  })),
  setExcludedFilterIds: (mode, ids) => set((state) => ({
    excludedFilterIds: { ...state.excludedFilterIds, [mode]: ids },
    selection: null,
    detailsOpen: false,
  })),
  setMapOverlayVisibility: (type, visible) => set((state) => ({
    mapOverlayVisibility: { ...state.mapOverlayVisibility, [type]: visible },
  })),
  setFactGeoKinds: (factGeoKinds) => set({ factGeoKinds }),
  setMapControlVisibility: (control, visible) => set((state) => ({
    mapControlVisibility: { ...state.mapControlVisibility, [control]: visible },
  })),
  setAllMapControlVisibility: (visible) => set((state) => ({
    mapControlVisibility: Object.fromEntries(
      Object.keys(state.mapControlVisibility).map((control) => [control, visible]),
    ) as Record<MapControl, boolean>,
  })),
}));
