import { useCallback, useEffect, useRef, useState } from "react";
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
import type { FactPoint, GeoPointKind, GeoPointsRequest } from "@/api/fact";
import {
  getGlobeZoomLimits,
  flattenWorldPosition,
  MAP_ZOOM_STEP,
} from "@/utils/map";
import { useDashboardStore } from "@/store";
import MapControls from "@/components/map/MapControls";
import RelationGraphCanvas from "@/components/map/RelationGraphCanvas";
import DashboardHeader from "../DashboardHeader";
import { mapScale } from "@/utils/impact";
import GlobeBackdrop from "./GlobeBackdrop";
import type { MapData } from "@/types";
import type { RelationTypeCatalog } from "@/api/relation";
import { getMapTooltip } from "@/utils/mapTooltip";

const repeatingFlatView = new MapView({ id: "main-map", repeat: true });
// 投影切换必须更换视图 ID，防止 deck.gl 复用上一种控制器的约束。
const globeView = new GlobeView({ id: "main-globe" });
// Relation mode clamps longitude separately. Finite vertical bounds avoid a
// width-only minimum zoom that would push the map below a short viewport.
const FLAT_BOUNDS: [[number, number], [number, number]] = [
  [-Infinity, -66],
  [Infinity, 85],
];
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
  maxBounds: FLAT_BOUNDS,
  scrollZoom: false,
};
const flatWorldController = {
  ...flatController,
  maxBounds: [
    [-Infinity, flattenWorldPosition([0, -66])[1]],
    [Infinity, flattenWorldPosition([0, 85])[1]],
  ] as [[number, number], [number, number]],
};
interface IProps {
  data?: Pick<MapData, "entities" | "relations" | "overlays">;
  graphData?: Pick<MapData, "entities" | "relations">;
  points?: FactPoint[];
  factsPending: boolean;
  relationsPending?: boolean;
  focusEntityIds?: string[];
  relationTypes?: RelationTypeCatalog;
}

const MapCanvas = ({
  data,
  graphData,
  points,
  factsPending,
  relationsPending,
  focusEntityIds,
  relationTypes,
}: IProps) => {
  const container = useRef<HTMLDivElement>(null);
  const size = useSize(container);
  const width = size?.width ?? 1200;
  const height = size?.height ?? 800;
  const world = useBoundaries("world");
  const china = useBoundaries("china");
  const {
    mode,
    mapOverlayVisibility,
    factGeoKinds,
    level,
    regionId,
    setFactRegion,
    setRegion,
    setHighlightedEntity,
  } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      mapOverlayVisibility: s.mapOverlayVisibility,
      factGeoKinds: s.factGeoKinds,
      level: s.level,
      regionId: s.regionId,
      setFactRegion: s.setFactRegion,
      setRegion: s.setRegion,
      setHighlightedEntity: s.setHighlightedEntity,
    })),
  );
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
  const changeRegion = useCallback(
    (countryId: string, provinceId?: string) => {
      if (mode === "fact") setFactRegion(countryId, provinceId);
      else
        setRegion(
          provinceId ? "province" : countryId ? "country" : "world",
          provinceId || countryId || undefined,
        );
    },
    [mode, setFactRegion, setRegion],
  );
  const flatWorld = level === "world" && !isGlobe;
  const visibleGeoKinds = (
    mode === "relation"
      ? mapOverlayVisibility.ports
        ? ["port" as GeoPointKind]
        : []
      : factGeoKinds
  ).filter(
    (kind) =>
      !(kind === "risk" && level !== "world") &&
      !(kind === "port" && level === "province"),
  );
  const geoRequest: GeoPointsRequest = {
    view:
      level === "world" || (level === "country" && regionId !== "CN")
        ? "global"
        : level === "province" && regionId === "430000"
          ? "hunan"
          : "china",
    ...(visibleGeoKinds.length
      ? { kinds: visibleGeoKinds as [GeoPointKind, ...GeoPointKind[]] }
      : {}),
  };
  const geoPoints = useFactGeoPoints(geoRequest);
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
    world: world.data,
    china: china.data,
    geoPoints: geoPoints.data,
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
      className={`map-canvas${isGlobe ? " map-canvas-globe" : ""}`}
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
        <DeckGL
          id="agri-map"
          style={{ zIndex: "2", display: isGraph ? "none" : undefined }}
          views={isGlobe ? globeView : repeatingFlatView}
          layers={layers}
          pickingRadius={mode === "relation" ? 3 : 0}
          viewState={camera}
          controller={
            isGlobe
              ? globeController
              : flatWorld
                ? flatWorldController
                : flatController
          }
          onClick={({ object }) => {
            if (mode === "relation" && !object) setHighlightedEntity(null);
          }}
          useDevicePixels={1}
          onInteractionStateChange={onInteractionStateChange}
          onViewStateChange={({ viewState, interactionState }) => {
            const next = viewState as MapViewState;
            markInteraction();
            // 保留控制器的 transition 字段，否则会打断原生惯性和滚轮平滑。
            if (
              !isGlobe &&
              interactionState.isZooming &&
              next.zoom < (cameraRef.current ?? target).zoom
            )
              setZoom(next);
            else setCamera(next);
          }}
          onError={(e) => setGpuError(e.message)}
          getTooltip={getMapTooltip}
        />
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
      {mode === "fact" &&
        (factsPending ||
          (visibleGeoKinds.length > 0 && geoPoints.isPending)) && (
          <div className="map-api-status">
            {factsPending && (
              <Spin size="small" description="正在加载事实星点" />
            )}
            {visibleGeoKinds.length > 0 && geoPoints.isPending && (
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
            setIsGlobe(view === "3d");
          }
        }}
        onToggleGlobe={() => setIsGlobe((value) => !value)}
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
