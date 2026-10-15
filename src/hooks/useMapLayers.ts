import { ECOLOGY_THEME as eco, geoThemeColor, rgba } from "@/utils/ecologyTheme";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  _GlobeViewport as GlobeViewport,
  WebMercatorViewport,
} from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useDashboardStore } from "@/store";
import type { Boundaries, MapData } from "@/types";
import type { FactPoint, GeoPoint, GeoPointKind } from "@/api/fact";
import type { RelationTypeCatalog } from "@/api/relation";
import { getMapPointScale, flattenWorldBoundaries, flattenWorldPosition } from "@/utils/map";
import { layoutFactPoints } from "@/utils/factPointLayout";
import { createGlobeSurface } from "@/utils/globeSurface";
import { createMapLayers, createInfluenceLayers } from "@/utils/mapLayers";
import {
  createRelationLayers,
  prepareRelationPaths,
  createRelationFlowLayer,
} from "@/utils/relationLayers";

interface Options {
  data?: Pick<MapData, "entities" | "relations" | "overlays">;
  points?: FactPoint[];
  world?: Boundaries;
  china?: Boundaries;
  geoPoints?: GeoPoint[];
  camera: MapViewState;
  width: number;
  height: number;
  isGlobe: boolean;
  flatWorld: boolean;
  paused: boolean;
  relationTypes?: RelationTypeCatalog;
  focusEntityIds?: string[];
  setIsGlobe: (value: boolean) => void;
  changeRegion: (countryId: string, provinceId?: string) => void;
}

const geoColors: Record<GeoPointKind, [number, number, number, number]> = {
  region: [98, 210, 120, 220],
  port: [81, 175, 230, 220],
  airport: [164, 148, 235, 220],
  market: [245, 171, 91, 220],
  risk: [245, 100, 100, 220],
};
/** 按更新频率组织图层：底图、路径、可见性、动画各自缓存。 */
export function useMapLayers({
  data,
  points,
  world,
  china,
  geoPoints,
  camera,
  width,
  height,
  isGlobe,
  flatWorld,
  paused,
  relationTypes,
  focusEntityIds,
  setIsGlobe,
  changeRegion,
}: Options) {
  const {
    mode,
    level,
    regionId,
    colorTheme,
    mapOverlayVisibility,
    highlightedEntityId,
    relationGlow,
    select,
    selection,
  } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      level: s.level,
      regionId: s.regionId,
      colorTheme: s.colorTheme,
      mapOverlayVisibility: s.mapOverlayVisibility,
      highlightedEntityId: s.highlightedEntityId,
      relationGlow: s.relationGlow,
      select: s.select,
      selection: s.selection,
    })),
  );
  const pointScale = getMapPointScale(level, isGlobe);
  const [animationSeconds, setAnimationSeconds] = useState(0);
  const influencePhase = (animationSeconds / 2.4) % 1;
  const flatWorldBoundaries = useMemo(
    () => (world && flatWorld ? flattenWorldBoundaries(world) : world),
    [world, flatWorld],
  );
  useEffect(() => {
    if (paused) return;
    if (
      mode === "fact"
        ? !mapOverlayVisibility.influence ||
          !points?.some(
            (point) =>
              Number.isFinite(point.impactRadiusKm) &&
              point.impactRadiusKm! > 0,
          )
        : !data?.relations.length
    )
      return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 32) {
        setAnimationSeconds(now / 1000);
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    paused,
    mode,
    mapOverlayVisibility.influence,
    points,
    data?.relations.length,
  ]);

  const viewport = useMemo(
    () =>
      isGlobe
        ? new GlobeViewport({ ...camera, width, height })
        : new WebMercatorViewport({ ...camera, width, height }),
    [camera, width, height, isGlobe],
  );
  useEffect(() => {
    if (!relationGlow.until) return;
    const until = relationGlow.until;
    const timer = setTimeout(
      () => {
        if (useDashboardStore.getState().relationGlow.until === until)
          useDashboardStore.setState({
            relationGlow: { entityIds: [], relationIds: [], until: 0 },
          });
      },
      Math.max(0, until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [relationGlow.until]);
  // 地理底图与事实点不依赖相机，拖动时直接复用。
  const baseLayers = useMemo(
    () =>
      createMapLayers({
        world: flatWorldBoundaries,
        china: china,
        points,
        selectedFactId: selection?.kind === "fact" ? selection.id : undefined,
        flatWorld,
        level,
        regionId,
        mode,
        colorTheme,
        data,
        overlayVisibility: mapOverlayVisibility,
        select: isGlobe ? () => { setIsGlobe(false); changeRegion(""); } : select,
        selectCountry: (id) => {
          setIsGlobe(false);
          changeRegion(isGlobe ? "" : id);
        },
        selectProvince: (id) => {
          setIsGlobe(false);
          if (isGlobe) changeRegion("");
          else changeRegion("CN", id);
        },
      }),
    // DeckGL 按投影重新挂载，必须创建尚未被旧实例销毁的图层。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [
      flatWorldBoundaries,
      china,
      points,
      selection,
      flatWorld,
      isGlobe,
      level,
      regionId,
      mode,
      colorTheme,
      data,
      mapOverlayVisibility,
      select,
      setIsGlobe,
      changeRegion,
    ],
  );

  const oceanLayer = useMemo(
    () => isGlobe ? createGlobeSurface(colorTheme) : null,
    [isGlobe, colorTheme],
  );
  const renderedBaseLayers = useMemo(() => {
    if (mode !== "fact" || !points?.length) return baseLayers;
    const positions = layoutFactPoints(
      points,
      (position) => viewport.project(flatWorld ? flattenWorldPosition(position as [number, number]) : position),
      (position) => viewport.unproject(position),
      ([lng, lat]) => {
        if (!isGlobe) return true;
        // 背面点不能反投影到正面，也避免在球面边缘展开到轮廓外。
        const radians = Math.PI / 180;
        const center = camera.latitude * radians;
        const latitude = lat * radians;
        return Math.sin(latitude) * Math.sin(center) +
          Math.cos(latitude) * Math.cos(center) * Math.cos((lng - camera.longitude) * radians) > 0.15;
      },
      pointScale,
    );
    return baseLayers.map((layer) => layer.id === "real-facts"
      ? (layer as ScatterplotLayer<FactPoint>).clone({
          getPosition: (point: FactPoint) => positions.get(point) ??
            (flatWorld ? flattenWorldPosition(point.geoPoint) : point.geoPoint),
          radiusScale: pointScale,
          getRadius: (point: FactPoint) => positions.has(point) ? 3 : 5,
          updateTriggers: { ...layer.props.updateTriggers, getPosition: [positions], getRadius: [positions] },
        })
      : layer);
  }, [mode, points, viewport, flatWorld, baseLayers, isGlobe, camera.latitude, camera.longitude, pointScale]);

  const relationPaths = useMemo(
    () =>
      prepareRelationPaths(
        data?.entities ?? [],
        data?.relations ?? [],
        isGlobe,
        flatWorld,
      ),
    [data?.entities, data?.relations, isGlobe, flatWorld],
  );
  // 球面图层只随业务数据变化，相机转动交给 DeckGL 的视图矩阵。
  const relationViewport = isGlobe ? undefined : viewport;
  const relationLayers = useMemo(
    () =>
      mode === "relation"
        ? createRelationLayers({
            pointScale,
            entities: data?.entities ?? [],
            relations: data?.relations ?? [],
            paths: relationPaths,
            flatWorld,
            isGlobe,
            longitude: 0,
            latitude: 0,
            highlightedEntityId,
            focusEntityIds,
            glowingEntityIds: relationGlow.entityIds,
            glowingRelationIds: relationGlow.relationIds,
            width,
            height,
            project: relationViewport ? (position) => relationViewport.project(position) : undefined,
            select: isGlobe ? () => { setIsGlobe(false); changeRegion(""); } : select,
            relationTypes,
            colorTheme,
          })
        : [],
    [
      mode,
      data,
      relationPaths,
      pointScale,
      flatWorld,
      isGlobe,
      highlightedEntityId,
      focusEntityIds,
      relationGlow,
      width,
      height,
      relationViewport,
      select,
      relationTypes,
      colorTheme,
      setIsGlobe,
      changeRegion,
    ],
  );
  const flowLayer = useMemo(
    () =>
      mode === "relation"
        ? createRelationFlowLayer(relationLayers, animationSeconds)
        : null,
    [mode, relationLayers, animationSeconds],
  );
  const geoLayer = useMemo(
    () =>
      new ScatterplotLayer<GeoPoint>({
        id: "fact-geo-points",
        data:
          mode === "fact" || mapOverlayVisibility.ports
            ? (geoPoints ?? []).filter(
                (point) => mode === "fact" || point.kind === "port",
              )
            : [],
        pickable: true,
        getPosition: (point) =>
          flatWorld ? flattenWorldPosition(point.geoPoint) : point.geoPoint,
        getRadius: 7,
        radiusScale: pointScale,
        radiusUnits: "pixels",
        getFillColor: (point) => colorTheme === "light" ? rgba(geoThemeColor(point.kind), 235) : geoColors[point.kind],
        stroked: colorTheme === "light",
        getLineColor: rgba(eco.panel, 240),
        getLineWidth: (point) => point.kind === "port" || point.kind === "airport" ? 2 : 0,
        lineWidthUnits: "pixels",
        updateTriggers: { getFillColor: colorTheme, getPosition: flatWorld },
      }),
    // 投影切换时为新的 DeckGL 实例重新创建图层。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [mode, mapOverlayVisibility.ports, geoPoints, flatWorld, isGlobe, colorTheme, pointScale],
  );
  const influenceLayers = useMemo(
    () =>
      mode === "fact" && mapOverlayVisibility.influence
        ? createInfluenceLayers(points ?? [], influencePhase, flatWorld, colorTheme)
        : [],
    // 投影切换时为新的 DeckGL 实例重新创建图层。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [mode, mapOverlayVisibility.influence, points, influencePhase, flatWorld, isGlobe, colorTheme],
  );
  return [
    oceanLayer,
    ...renderedBaseLayers,
    ...influenceLayers,
    ...relationLayers,
    flowLayer,
    geoLayer,
  ];
}
