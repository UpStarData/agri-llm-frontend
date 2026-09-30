import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import {
  _GlobeView as GlobeView,
  _GlobeViewport as GlobeViewport,
  MapView,
  WebMercatorViewport,
} from "@deck.gl/core";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { Alert, Button, Spin } from "antd";
import {
  AimOutlined,
  CompressOutlined,
  ExpandOutlined,
  GlobalOutlined,
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useSize } from "ahooks";
import { useBoundaries, useFactGeoPoints } from "@/hooks";
import type {
  FactPoint,
  GeoPoint,
  GeoPointKind,
  GeoPointsRequest,
} from "@/api/fact";
import { createMapLayers } from "@/utils/mapLayers";
import {
  getGlobeFitZoom,
  getGlobeZoomLimits,
  flattenWorldBoundaries,
  flattenWorldPosition,
  getFlatLongitudeLimits,
  getWheelZoomStep,
  getRegionView,
  getWorldZoom,
  GLOBE_MIN_ZOOM,
  GLOBE_WORLD_LATITUDE,
  MAP_ZOOM_STEP,
} from "@/utils/map";
import { useDashboardStore } from "@/store";
import FactMapTools from "@/pages/Dashboard/component/FactMapTools";
import DashboardHeader from "./DashboardHeader";
import { mapScale } from "@/utils/impact";
import StarField from "./StarField";
import type { MapData } from "@/types";
import { formatDate } from "@/utils/date";

const flatView = new MapView({ id: "main-map", repeat: false });
const repeatingFlatView = new MapView({ id: "main-map", repeat: true });
const globeView = new GlobeView({ id: "main-map" });
// Relation mode clamps longitude separately. Finite vertical bounds avoid a
// width-only minimum zoom that would push the map below a short viewport.
const FLAT_BOUNDS: [[number, number], [number, number]] = [
  [-Infinity, -66],
  [Infinity, 85],
];
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
const geoColors: Record<GeoPointKind, [number, number, number, number]> = {
  region: [98, 210, 120, 220],
  port: [81, 175, 230, 220],
  airport: [164, 148, 235, 220],
  market: [245, 171, 91, 220],
  risk: [245, 100, 100, 220],
};
const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

function getMapTooltip(info: PickingInfo) {
  const { object, layer } = info;
  if (!object || !layer) return null;
  let text: string | undefined;
  if (layer.id === "real-facts") {
    const point = object as FactPoint;
    text = `${point.title || point.factId}\n时间：${formatDate(point.occurredAt)}`;
  } else if (
    layer.id.startsWith("world-boundaries") ||
    layer.id.startsWith("china-boundaries")
  ) {
    const { name, regionId } = object.properties ?? {};
    const translated =
      layer.id.startsWith("world-boundaries") &&
      /^[A-Z]{2}$/.test(regionId ?? "")
        ? regionNames.of(regionId)
        : undefined;
    text = translated && translated !== regionId ? translated : name;
  } else {
    text = object.name || object.type;
  }
  return text
    ? {
        text,
        style: {
          zIndex: "6",
          marginLeft: "12px",
          marginTop: "12px",
          maxWidth: "280px",
          whiteSpace: "pre-line",
          border: "1px solid rgba(129, 194, 196, 0.4)",
          borderRadius: "4px",
          backgroundColor: "rgba(15, 28, 34, 0.94)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          color: "#f0f8f8",
          fontSize: "12px",
          lineHeight: "1.5",
        },
      }
    : null;
}

interface IProps {
  data?: MapData;
  points?: FactPoint[];
  factsPending: boolean;
}

const MapCanvas = ({ data, points, factsPending }: IProps) => {
  const container = useRef<HTMLDivElement>(null);
  const size = useSize(container);
  const width = size?.width ?? 1200;
  const height = size?.height ?? 800;
  const world = useBoundaries("world");
  const china = useBoundaries("china");
  const {
    mode,
    colorTheme,
    mapControlVisibility,
    mapOverlayVisibility,
    factGeoKinds,
    level,
    regionId,
    select,
    setFactRegion,
  } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      colorTheme: s.colorTheme,
      mapControlVisibility: s.mapControlVisibility,
      mapOverlayVisibility: s.mapOverlayVisibility,
      factGeoKinds: s.factGeoKinds,
      level: s.level,
      regionId: s.regionId,
      select: s.select,
      setFactRegion: s.setFactRegion,
    })),
  );
  const [gpuError, setGpuError] = useState<string>();
  const [isGlobe, setIsGlobe] = useState(false);
  const flatWorld = level === "world" && !isGlobe;
  const visibleGeoKinds = factGeoKinds.filter(
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
  const flatWorldBoundaries = useMemo(
    () =>
      world.data && flatWorld ? flattenWorldBoundaries(world.data) : world.data,
    [world.data, flatWorld],
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const showMapControls = (
    Object.entries(mapControlVisibility) as [
      keyof typeof mapControlVisibility,
      boolean,
    ][]
  ).some(
    ([control, visible]) =>
      visible &&
      (mode === "fact" ||
        (control !== "influence" &&
          control !== "video" &&
          control !== "search")),
  );
  const [influencePhase, setInfluencePhase] = useState(0);
  const lastInteractionAt = useRef(0);
  const cameraRef = useRef<MapViewState | undefined>(undefined);

  useEffect(() => {
    const syncFullscreen = () =>
      setIsFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (
      mode !== "fact" ||
      !mapOverlayVisibility.influence ||
      !points?.some((point) => Number.isFinite(point.impactRadiusKm) && point.impactRadiusKm! > 0)
    )
      return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 70) {
        setInfluencePhase((now % 2400) / 2400);
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, mapOverlayVisibility.influence, points]);

  const flatTarget = useMemo(
    () => getRegionView(level, regionId, china.data, width, height, world.data),
    [level, regionId, china.data, width, height, world.data],
  );

  const globeTarget = useMemo<MapViewState>(() => {
    const latitude =
      level === "world" ? GLOBE_WORLD_LATITUDE : flatTarget.latitude;
    return {
      ...flatTarget,
      latitude,
      zoom: getGlobeFitZoom(width, height, latitude),
      minZoom: GLOBE_MIN_ZOOM,
      maxZoom: getGlobeZoomLimits(width, height, 0).maxZoom,
      transitionDuration: 0,
    };
  }, [flatTarget, level, width, height]);
  const target = isGlobe ? globeTarget : flatTarget;
  const [interaction, setInteraction] = useState<{
    target: MapViewState;
    view: MapViewState;
  }>();
  const camera = interaction?.target === target ? interaction.view : target;
  // Measure the projected limb directly. A simple world-radius conversion
  // overestimates the visible globe in deck.gl's perspective viewport.
  const globeDiameter = useMemo(() => {
    if (!isGlobe) return 0;
    const viewport = new GlobeViewport({
      width,
      height,
      longitude: 0,
      latitude: target.latitude,
      zoom: target.zoom,
    });
    const centerLatitude = (target.latitude * Math.PI) / 180;
    let radius = 0;
    for (let angle = 0; angle <= 90; angle++) {
      const arc = (angle * Math.PI) / 180;
      const latitude = Math.asin(Math.sin(centerLatitude) * Math.cos(arc));
      const longitude = Math.atan2(
        Math.sin(arc) * Math.cos(centerLatitude),
        Math.cos(arc) - Math.sin(centerLatitude) * Math.sin(latitude),
      );
      const [x, y] = viewport.project([
        (longitude * 180) / Math.PI,
        (latitude * 180) / Math.PI,
      ]);
      radius = Math.max(radius, Math.hypot(x - width / 2, y - height / 2));
    }
    return radius * 2;
  }, [isGlobe, width, height, target.latitude, target.zoom]);

  useLayoutEffect(() => {
    if (interaction?.target !== target) cameraRef.current = target;
  }, [interaction?.target, target]);

  const setCamera = useCallback(
    (update: MapViewState | ((previous: MapViewState) => MapViewState)) => {
      const previous = cameraRef.current ?? target;
      const view = typeof update === "function" ? update(previous) : update;
      cameraRef.current = view;
      setInteraction({ target, view });
    },
    [target],
  );

  const setZoom = useCallback(
    (view: MapViewState) => {
      if (!isGlobe && view.zoom <= getWorldZoom(width, height) + 0.001) {
        setIsGlobe(true);
        setFactRegion("");
        return;
      }
      setCamera(view);
    },
    [height, isGlobe, setCamera, setFactRegion, width],
  );
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (isGlobe) return;
      const current = cameraRef.current ?? target;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? height : 1);
      if (!delta) return;
      const step = getWheelZoomStep(delta);
      const limits = {
        minZoom: target.minZoom ?? 0,
        maxZoom: target.maxZoom ?? 12,
      };
      const zoom = Math.min(
        limits.maxZoom,
        Math.max(limits.minZoom, current.zoom - step),
      );
      lastInteractionAt.current = Date.now();
      if (Math.abs(zoom - current.zoom) < 0.00001) {
        if (delta > 0) setZoom({ ...current, zoom });
        return;
      }
      let next: MapViewState = { ...current, zoom, transitionDuration: 0 };
      if (!isGlobe) {
        const bounds = element.getBoundingClientRect();
        const pointer: [number, number] = [
          event.clientX - bounds.left,
          event.clientY - bounds.top,
        ];
        const anchor = new WebMercatorViewport({
          width,
          height,
          ...current,
        }).unproject(pointer);
        const moved = new WebMercatorViewport({
          width,
          height,
          ...next,
        }).panByPosition(anchor, pointer);
        const longitudeLimits = getFlatLongitudeLimits(width, zoom);
        next = {
          ...next,
          longitude:
            mode === "fact" || flatWorld
              ? (moved.longitude ?? current.longitude)
              : Math.min(
                  longitudeLimits.max,
                  Math.max(
                    longitudeLimits.min,
                    moved.longitude ?? current.longitude,
                  ),
                ),
          latitude: moved.latitude ?? current.latitude,
        };
      }
      setZoom(next);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [flatWorld, height, isGlobe, mode, setZoom, target, width]);
  useEffect(() => {
    if (!isGlobe || level !== "world") return;
    let frame = 0;
    let previousTime = 0;
    const rotate = (time: number) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;
      setCamera((view) => ({
        ...view,
        longitude: view.longitude + elapsed * 0.0007,
        transitionDuration: 0,
      }));
      frame = requestAnimationFrame(rotate);
    };
    frame = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(frame);
  }, [isGlobe, level, setCamera]);
  const layers = useMemo(
    () =>
      createMapLayers({
        world: flatWorldBoundaries,
        china: china.data,
        points,
        flatWorld,
        level,
        regionId,
        mode,
        colorTheme,
        data,
        overlayVisibility: mapOverlayVisibility,
        influencePhase,
        select,
        selectCountry: (id) => {
          setIsGlobe(false);
          setFactRegion(id);
        },
        selectProvince: (id) => {
          setIsGlobe(false);
          setFactRegion("CN", id);
        },
      }).concat(
        new ScatterplotLayer<GeoPoint>({
          id: "fact-geo-points",
          data: mode === "fact" ? (geoPoints.data ?? []) : [],
          pickable: true,
          getPosition: (point) =>
            flatWorld ? flattenWorldPosition(point.geoPoint) : point.geoPoint,
          getRadius: 7,
          radiusUnits: "pixels",
          getFillColor: (point) => geoColors[point.kind],
        }),
      ),
    [
      flatWorldBoundaries,
      flatWorld,
      china.data,
      level,
      regionId,
      mode,
      colorTheme,
      data,
      points,
      geoPoints.data,
      mapOverlayVisibility,
      influencePhase,
      select,
      setFactRegion,
    ],
  );
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
      {isFullscreen && <div className="map-fullscreen-header"><DashboardHeader /></div>}
      {isGlobe && (
        <>
          <StarField width={width} height={height} />
          <div
            className="map-globe-ocean"
            style={{ width: globeDiameter, height: globeDiameter }}
            aria-hidden="true"
          />
        </>
      )}
      {!gpuError && (
        <DeckGL
          id="agri-map"
          style={{ zIndex: "2" }}
          views={isGlobe ? globeView : flatWorld ? repeatingFlatView : flatView}
          layers={layers}
          viewState={camera}
          controller={
            isGlobe ? false : flatWorld ? flatWorldController : flatController
          }
          useDevicePixels={1}
          onViewStateChange={({ viewState, interactionState }) => {
            const next = viewState as MapViewState;
            const previous = cameraRef.current ?? target;
            const { minZoom, maxZoom } = isGlobe
              ? getGlobeZoomLimits(width, height, previous.latitude)
              : { minZoom: target.minZoom ?? 0, maxZoom: target.maxZoom ?? 12 };
            const isZooming = Boolean(interactionState?.isZooming);
            if (
              isZooming &&
              Math.abs(next.zoom - previous.zoom) < 0.00001 &&
              (previous.zoom <= minZoom + 0.001 ||
                previous.zoom >= maxZoom - 0.001)
            ) {
              lastInteractionAt.current = Date.now();
              return;
            }
            lastInteractionAt.current = Date.now();
            const longitudeLimits = getFlatLongitudeLimits(width, next.zoom);
            const updateCamera = next.zoom < previous.zoom ? setZoom : setCamera;
            updateCamera({
              ...next,
              longitude:
                isGlobe || mode === "fact" || flatWorld
                  ? next.longitude
                  : Math.min(
                      longitudeLimits.max,
                      Math.max(longitudeLimits.min, next.longitude),
                    ),
              transitionDuration: 0,
              transitionInterpolator: undefined,
            });
          }}
          onError={(e) => setGpuError(e.message)}
          getTooltip={getMapTooltip}
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
      {mode === "fact" && mapOverlayVisibility.influence && !isGlobe && (
        <div className="map-scale" aria-label={`地图中心比例尺 ${scale.label}`}>
          <span>{scale.label}</span>
          <div style={{ width: scale.pixels }} />
          <small>地图中心比例尺</small>
        </div>
      )}
      {showMapControls && (
        <div className="map-controls" aria-label="地图操作">
          <>
            {mapControlVisibility.globe && (
              <Button
                type="text"
                shape="circle"
                icon={<GlobalOutlined />}
                aria-label={isGlobe ? "切换到平面地图" : "切换到球体地图"}
                onClick={() => setIsGlobe((value) => !value)}
              />
            )}
            {mapControlVisibility.fullscreen && (
              <Button
                type="text"
                shape="circle"
                icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                aria-label={isFullscreen ? "退出全屏" : "展开全屏"}
                onClick={toggleFullscreen}
              />
            )}
            {mapControlVisibility.zoom && (
              <>
                <Button
                  type="text"
                  shape="circle"
                  icon={<PlusOutlined />}
                  aria-label="放大地图"
                  disabled={isGlobe}
                  onClick={() => {
                    const v = cameraRef.current ?? target;
                    setZoom({
                      ...v,
                      zoom: Math.min(
                        isGlobe
                          ? getGlobeZoomLimits(width, height, v.latitude)
                              .maxZoom
                          : (target.maxZoom ?? 12),
                        v.zoom + MAP_ZOOM_STEP,
                      ),
                      transitionDuration: 0,
                    });
                  }}
                />
                <Button
                  type="text"
                  shape="circle"
                  icon={<MinusOutlined />}
                  aria-label="缩小地图"
                  disabled={isGlobe}
                  onClick={() => {
                    const v = cameraRef.current ?? target;
                    setZoom({
                      ...v,
                      zoom: Math.max(
                        isGlobe
                          ? getGlobeZoomLimits(width, height, v.latitude)
                              .minZoom
                          : (target.minZoom ?? 0),
                        v.zoom - MAP_ZOOM_STEP,
                      ),
                      transitionDuration: 0,
                    });
                  }}
                />
              </>
            )}
            {mapControlVisibility.reset && (
              <Button
                type="text"
                shape="circle"
                icon={<AimOutlined />}
                aria-label="重置地图视角"
                onClick={() => setCamera(target)}
              />
            )}
            {mode === "fact" && <FactMapTools />}
          </>
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
