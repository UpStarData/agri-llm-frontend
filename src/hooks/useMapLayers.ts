import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  _GlobeViewport as GlobeViewport,
  WebMercatorViewport,
} from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import { IconLayer } from "@deck.gl/layers";
import { useDashboardStore } from "@/store";
import type { Boundaries, MapData } from "@/types";
import type { FactPoint, GeoPoint } from "@/api/fact";
import type { RelationTypeCatalog } from "@/api/relation";
import { getMapPointScale, flattenWorldBoundaries, flattenWorldPosition } from "@/utils/map";
import { getKmPerPixel } from "@/utils/impact";
import { layoutFactPoints } from "@/utils/factPointLayout";
import { geoPointIcon } from "@/utils/geoPointIcons";
import { createGlobeSurface } from "@/utils/globeSurface";
import { createMapLayers, createInfluenceLayers, applyFactPointLayout } from "@/utils/mapLayers";
import {
  createRelationLayers,
  prepareRelationPaths,
  createRelationFlowLayer,
  revealRelationLayers,
} from "@/utils/relationLayers";

/** 影响圆单次扩散的周期（秒）。 */
const INFLUENCE_CYCLE_SECONDS = 3.6;

interface Options {
  data?: Pick<MapData, "entities" | "relations" | "overlays">;
  points?: FactPoint[];
  glowingFactIds?: string[];
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

/** 按更新频率组织图层：底图、路径、可见性、动画各自缓存。 */
export function useMapLayers({
  data,
  points,
  glowingFactIds,
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
  const influencePhase = (animationSeconds / INFLUENCE_CYCLE_SECONDS) % 1;
  // 影响圆的采样密度按当前视图比例换算，屏幕上的圆有多大就切多少段。
  const influenceKmPerPixel = getKmPerPixel(camera.zoom, camera.latitude);
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
      // 逐帧推进：球体自转是 60fps，波纹按 30fps 跳步会和自转之间形成肉眼可见的顿挫。
      if (now - last > 16) {
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
        glowingFactIds,
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
      glowingFactIds,
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
    return applyFactPointLayout(baseLayers, positions, pointScale, flatWorld);
  }, [mode, points, viewport, flatWorld, baseLayers, isGlobe, camera.latitude, camera.longitude, pointScale]);

  // 用关系 ID 集合标识一轮展示；拖动相机、普通数据刷新不会重新播放。
  const relationRevealKey = JSON.stringify([mode, level, regionId, data?.relations.map((relation) => relation.id)]);
  const relationCount = data?.relations.length ?? 0;
  const [reveal, setReveal] = useState({ key: "", seconds: 0 });
  const revealSeconds = reveal.key === relationRevealKey ? reveal.seconds : 0;
  useEffect(() => {
    if (mode !== "relation") {
      setReveal({ key: "", seconds: 0 });
      return;
    }
    if (!relationCount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReveal({ key: relationRevealKey, seconds: Infinity });
      return;
    }
    let frame = 0;
    let start: number | undefined;
    const duration = Math.floor((relationCount - 1) / 5) * 0.18 + 1.2;
    const tick = (now: number) => {
      start ??= now;
      const seconds = (now - start) / 1000;
      setReveal({ key: relationRevealKey, seconds: seconds >= duration ? Infinity : seconds });
      if (seconds < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, relationRevealKey, relationCount]);

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
  const revealedRelationLayers = useMemo(
    () => revealRelationLayers(relationLayers, revealSeconds),
    [relationLayers, revealSeconds],
  );
  const flowLayer = useMemo(
    () =>
      mode === "relation"
        ? createRelationFlowLayer(revealedRelationLayers, animationSeconds)
        : null,
    [mode, revealedRelationLayers, animationSeconds],
  );
  const geoLayer = useMemo(
    () =>
      new IconLayer<GeoPoint>({
        id: "fact-geo-points",
        data:
          mode === "fact" || mapOverlayVisibility.ports
            ? (geoPoints ?? []).filter(
                (point) => mode === "fact" || point.kind === "port",
              )
            : [],
        pickable: true,
        billboard: true,
        sizeUnits: "pixels",
        sizeBasis: "height",
        getPosition: (point) =>
          flatWorld ? flattenWorldPosition(point.geoPoint) : point.geoPoint,
        getIcon: (point) => geoPointIcon(point.kind, colorTheme),
        getSize: 24,
        sizeScale: pointScale,
        // 图标自带主题色，这里不再着色，只保留不透明度。
        getColor: [255, 255, 255, 240],
        // SVG 固定走 HTMLImageElement 解码：部分浏览器不支持把 SVG 转成 ImageBitmap。
        loadOptions: { image: { type: "image" } },
        updateTriggers: { getIcon: colorTheme, getPosition: flatWorld },
      }),
    // 投影切换时为新的 DeckGL 实例重新创建图层。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [mode, mapOverlayVisibility.ports, geoPoints, flatWorld, isGlobe, colorTheme, pointScale],
  );
  const influenceLayers = useMemo(
    () =>
      mode === "fact" && mapOverlayVisibility.influence
        ? createInfluenceLayers(points ?? [], influencePhase, flatWorld, colorTheme, influenceKmPerPixel)
        : [],
    // 投影切换时为新的 DeckGL 实例重新创建图层。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [mode, mapOverlayVisibility.influence, points, influencePhase, flatWorld, isGlobe, colorTheme, influenceKmPerPixel],
  );
  return [
    oceanLayer,
    ...renderedBaseLayers,
    ...influenceLayers,
    ...revealedRelationLayers,
    flowLayer,
    geoLayer,
  ];
}
