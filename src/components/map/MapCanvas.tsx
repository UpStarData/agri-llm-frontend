import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DeckGL } from "@deck.gl/react";
import {
  _GlobeView as GlobeView,
  _GlobeController as GlobeController,
  MapView,
} from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import { Alert, Spin } from "antd";
import { useMapLayers } from "@/hooks/useMapLayers";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useSize } from "ahooks";
import { useBoundaries, useFactGeoPoints } from "@/hooks";
import type { FactPoint, GeoPoint, GeoPointKind, GeoPointsRequest } from "@/api/fact";
import {
  getGlobeZoomLimits,
  MAP_ZOOM_STEP,
} from "@/utils/map";
import { useDashboardStore } from "@/store";
import MapControls from "@/components/map/MapControls";
import RelationGraphCanvas from "@/components/map/RelationGraphCanvas";
import DashboardHeader from "../DashboardHeader";
import { mapScale } from "@/utils/impact";
import { getFactView } from "@/utils/factView";
import { geoPointKindAvailable } from "@/utils/geoPointKinds";
import GlobeBackdrop from "./GlobeBackdrop";
import GeoPointInfoCard from "./GeoPointInfoCard";
import type { MapData } from "@/types";
import type { RelationTypeCatalog } from "@/api/relation";
import { getMapTooltip } from "@/utils/mapTooltip";

const repeatingFlatView = new MapView({ id: "main-map", repeat: true });
// 投影切换必须更换视图 ID，防止 deck.gl 复用上一种控制器的约束。
const globeView = new GlobeView({ id: "main-globe", resolution: 2 });
const globeController = {
  type: GlobeController,
  dragPan: true,
  dragRotate: true,
  scrollZoom: { smooth: true },
  inertia: 300,
  zoomAround: "center" as const,
};
const flatController = {
  dragPan: true,
  dragRotate: false,
  keyboard: true,
  normalize: false,
  scrollZoom: false,
  inertia: 200,
};
interface IProps {
  data?: Pick<MapData, "entities" | "relations" | "overlays">;
  graphData?: Pick<MapData, "entities" | "relations">;
  points?: FactPoint[];
  glowingFactIds?: string[];
  factsPending: boolean;
  factsFetching?: boolean;
  relationsPending?: boolean;
  focusEntityIds?: string[];
  relationTypes?: RelationTypeCatalog;
}

const MapCanvas = ({
  data,
  graphData,
  points,
  glowingFactIds,
  factsPending,
  factsFetching,
  relationsPending,
  focusEntityIds,
  relationTypes,
}: IProps) => {
  const container = useRef<HTMLDivElement>(null);
  const size = useSize(container);
  const width = Math.max(size?.width ?? 1200, 1);
  const height = Math.max(size?.height ?? 800, 1);
  const world = useBoundaries("world");
  const china = useBoundaries("china");
  const {
    mode,
    colorTheme,
    mapOverlayVisibility,
    factGeoKinds,
    countryId,
    provinceId,
    level,
    regionId,
    setRegion,
    setHighlightedEntity,
  } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      colorTheme: s.colorTheme,
      mapOverlayVisibility: s.mapOverlayVisibility,
      factGeoKinds: s.factGeoKinds,
      countryId: s.factFilters.countryId,
      provinceId: s.factFilters.provinceId,
      level: s.level,
      regionId: s.regionId,
      setRegion: s.setRegion,
      setHighlightedEntity: s.setHighlightedEntity,
    })),
  );
  const [geoPointSelection, setSelectedGeoPoint] = useState<GeoPoint | null>(null);
  const [globeHovered, setGlobeHovered] = useState(false);
  const [gpuError, setGpuError] = useState<string>();
  const [globeModes, setGlobeModes] = useState({ fact: false, relation: true });
  const [relationView, setRelationView] = useState<"map" | "graph">("map");
  const [graphZoom, setGraphZoom] = useState(1);
  const isGraph = mode === "relation" && relationView === "graph";
  const isGlobe = globeModes[mode];
  const setIsGlobe = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      setGlobeModes((previous) => ({
        ...previous,
        [mode]: typeof value === "function" ? value(previous[mode]) : value,
      }));
    },
    [mode],
  );
  // 地图点击只切换取景（中国/全球/湖南视角），右侧卡片沿用左侧区域筛选，不跟着变。
  const changeRegion = useCallback(
    (countryId: string, provinceId?: string) =>
      setRegion(
        provinceId ? "province" : countryId ? "country" : "world",
        provinceId || countryId || undefined,
      ),
    [setRegion],
  );
  const flatWorld = level === "world" && !isGlobe;
  // 叠加点位跟左侧区域筛选走：地图放大缩小、点击下钻只改取景，不换数据、不重新请求接口。
  const visibleGeoKinds = useMemo(() => (
    mode === "relation"
      ? mapOverlayVisibility.ports
        ? ["port" as GeoPointKind]
        : []
      : factGeoKinds
  ).filter((kind) => geoPointKindAvailable(kind, countryId, provinceId)),
    [mode, mapOverlayVisibility.ports, factGeoKinds, countryId, provinceId]);
  const geoRequest: GeoPointsRequest = {
    view: getFactView(countryId, provinceId),
    ...(visibleGeoKinds.length
      ? { kinds: visibleGeoKinds as [GeoPointKind, ...GeoPointKind[]] }
      : {}),
  };
  const geoPoints = useFactGeoPoints(geoRequest);
  const visibleGeoPoints = useMemo(
    () => geoPoints.data?.filter((point) => visibleGeoKinds.includes(point.kind)),
    [geoPoints.data, visibleGeoKinds],
  );
  const selectedGeoPoint = visibleGeoPoints?.find((point) => point === geoPointSelection);
  const geoPending =
    visibleGeoKinds.length > 0 &&
    (geoPoints.isPending || geoPoints.isPlaceholderData);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () =>
      setIsFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const {
    camera,
    cameraRef,
    target,
    setCamera,
    setZoom,
    markInteraction,
    onInteractionStateChange,
  } = useMapCamera({
    mode,
    level,
    regionId,
    width,
    height,
    china: china.data,
    world: world.data,
    isGlobe,
    paused: isGraph,
    container,
    setIsGlobe,
    changeRegion,
  });
  const layers = useMapLayers({
    data,
    points,
    factsPending,
    factsFetching,
  glowingFactIds,
    world: world.data,
    china: china.data,
    geoPoints: visibleGeoPoints,
    onGeoPointClick: setSelectedGeoPoint,
    camera,
    width,
    height,
    isGlobe,
    flatWorld,
    paused: isGraph,
    relationTypes,
    focusEntityIds,
    setIsGlobe,
    changeRegion,
  });
  const scale = mapScale(camera.zoom, camera.latitude, flatWorld);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await container.current?.requestFullscreen();
  };
  return (
    <div
      className={`map-canvas${isGlobe ? " map-canvas-globe" : ""}${globeHovered ? " map-globe-hover" : ""}`}
      ref={container}
      aria-label="农业产业链地图"
    >
      {isFullscreen && (
        <div className="map-fullscreen-header">
          <DashboardHeader />
        </div>
      )}
      {isGlobe && !isGraph && (
        <GlobeBackdrop
          width={width}
          height={height}
          latitude={camera.latitude}
          zoom={camera.zoom}
        />
      )}
      {!gpuError && (
        // 球面必须重新细分多边形，不能复用平面投影的网格与三角剖分。
        <DeckGL
          key={isGlobe ? "globe" : "flat"}
          id="agri-map"
          style={{ zIndex: "2", display: isGraph ? "none" : undefined }}
          views={isGlobe ? globeView : repeatingFlatView}
          layers={layers}
          onHover={({ object }) => setGlobeHovered(isGlobe && Boolean(object))}
          getCursor={({ isDragging, isHovering }) => isDragging ? "grabbing" : isHovering ? "pointer" : "grab"}
          pickingRadius={mode === "relation" ? 3 : 0}
          viewState={camera}
          controller={isGlobe ? globeController : flatController}
          onClick={({ object }) => {
            setSelectedGeoPoint(null);
            if (isGlobe) {
              changeRegion("");
              setIsGlobe(false);
              return;
            }
            if (mode === "relation" && !object) setHighlightedEntity(null);
          }}
          useDevicePixels={1}
          onInteractionStateChange={onInteractionStateChange}
          onViewStateChange={({ viewState, interactionState }) => {
            const next = viewState as MapViewState;
            markInteraction();
            // 保留控制器的 transition 字段，否则会打断原生惯性和滚轮平滑。
            // 控制器发起的缩放（双指、双击）同样走 setZoom：放大时和滚轮一样能下钻。
            if (interactionState.isZooming) setZoom(next);
            else setCamera(next);
          }}
          onError={(e) => setGpuError(e.message)}
          getTooltip={(info) => selectedGeoPoint && info.layer?.id === "fact-geo-points"
            ? null : getMapTooltip(info, colorTheme)}
        >
          {({ viewport }) => selectedGeoPoint && !isGraph && (
            <GeoPointInfoCard
              point={selectedGeoPoint}
              viewport={viewport}
              onClose={() => setSelectedGeoPoint(null)}
            />
          )}
        </DeckGL>
      )}
      {isGraph && (
        <RelationGraphCanvas
          entities={graphData?.entities ?? []}
          relations={graphData?.relations ?? []}
          relationTypes={relationTypes}
          zoom={graphZoom}
        />
      )}
      {(world.isPending || china.isPending) && (
        <div className="map-status">
          <Spin description="正在加载地理边界">
            <div className="map-loading" />
          </Spin>
        </div>
      )}
      {gpuError && (
        <div className="map-status">
          <Alert type="error" title="地图渲染失败" description={gpuError} />
        </div>
      )}
      {mode === "fact" && (factsPending || geoPending) && (
        <div className="map-api-status">
          {factsPending && (
            <Spin size="small" description="正在加载事实星点" />
          )}
          {geoPending && (
            <Spin size="small" description="正在加载叠加点位" />
          )}
        </div>
      )}
      {mode === "relation" && relationsPending && (
        <div className="map-api-status">
          <Spin size="small" description="正在加载关联数据" />
        </div>
      )}
      {mode === "fact" && mapOverlayVisibility.influence && !isGlobe && (
        <div className="map-scale" aria-label={`地图中心比例尺 ${scale.label}`}>
          <span>{scale.label}</span>
          <div style={{ width: scale.pixels }} />
          <small>地图中心比例尺</small>
        </div>
      )}
      <MapControls
        isGlobe={isGlobe}
        isGraph={isGraph}
        isFullscreen={isFullscreen}
        onViewChange={(view) => {
          if (view === "graph") setRelationView("graph");
          else {
            setRelationView("map");
            if (isGlobe && view === "2d") changeRegion("");
            setIsGlobe(view === "3d");
          }
        }}
        onToggleGlobe={() => {
          if (isGlobe) changeRegion("");
          setIsGlobe((value) => !value);
        }}
        onFullscreen={toggleFullscreen}
        onReset={() => (isGraph ? setGraphZoom(1) : setCamera(target))}
        onZoom={(direction) => {
          markInteraction();
          if (isGraph) {
            setGraphZoom((value) =>
              Math.min(4, Math.max(0.35, value * (direction > 0 ? 1.25 : 0.8))),
            );
            return;
          }
          const view = cameraRef.current ?? target;
          const limits = isGlobe
            ? getGlobeZoomLimits(width, height, view.latitude)
            : { minZoom: target.minZoom ?? 0, maxZoom: target.maxZoom ?? 12 };
          setZoom({
            ...view,
            zoom: Math.min(
              limits.maxZoom,
              Math.max(limits.minZoom, view.zoom + direction * MAP_ZOOM_STEP),
            ),
            transitionDuration: 0,
          });
        }}
      />
    </div>
  );
};

export default MapCanvas;
