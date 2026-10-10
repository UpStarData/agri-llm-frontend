import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WebMercatorViewport } from "@deck.gl/core";
import type { MapViewState, InteractionState } from "@deck.gl/core";
import type { Boundaries, MapLevel, Mode } from "@/types";
import {
  getGlobeFitZoom,
  getGlobeZoomLimits,
  getWheelZoomStep,
  getRegionView,
  getWorldZoom,
  GLOBE_MIN_ZOOM,
  GLOBE_WORLD_LATITUDE,
  clampFlatView,
  flattenWorldPosition,
  isGlobeMaxZoom,
} from "@/utils/map";
interface IOptions {
  mode: Mode;
  level: MapLevel;
  regionId?: string;
  width: number;
  height: number;
  china?: Boundaries;
  world?: Boundaries;
  isGlobe: boolean;
  paused?: boolean;
  container: React.RefObject<HTMLDivElement | null>;
  setIsGlobe: (value: boolean) => void;
  changeRegion: (countryId: string, provinceId?: string) => void;
}
export const useMapCamera = ({
  mode,
  level,
  regionId,
  width,
  height,
  china,
  world,
  isGlobe,
  paused = false,
  container,
  setIsGlobe,
  changeRegion,
}: IOptions) => {
  const lastInteractionAt = useRef(0);
  const interacting = useRef(false);
  const cameraRef = useRef<MapViewState | undefined>(undefined);
  const flatTarget = useMemo(
    () => getRegionView(level, regionId, china, width, height, world),
    [level, regionId, china, width, height, world],
  );

  const globeTarget = useMemo<MapViewState>(() => {
    const latitude =
      level === "world" ? GLOBE_WORLD_LATITUDE : flatTarget.latitude;
    return {
      ...flatTarget,
      latitude,
      zoom: getGlobeFitZoom(width, height, latitude),
      // GlobeController 会自行按纬度修正边界，这里传赤道基准。
      minZoom: GLOBE_MIN_ZOOM,
      maxZoom: getGlobeZoomLimits(width, height, 0).maxZoom,
      transitionDuration: 0,
    };
  }, [flatTarget, level, width, height]);
  const target = isGlobe ? globeTarget : flatTarget;
  const targetKey = `${level}:${regionId ?? ""}:${width}:${height}:${isGlobe}`;
  const [interactions, setInteractions] = useState<
    Partial<Record<typeof mode, { targetKey: string; view: MapViewState }>>
  >({});
  const interaction = interactions[mode];
  const camera =
    interaction?.targetKey === targetKey ? interaction.view : target;
  useLayoutEffect(() => {
    cameraRef.current = camera;
  }, [camera, mode]);

  const setCamera = useCallback(
    (update: MapViewState | ((previous: MapViewState) => MapViewState)) => {
      const previous = cameraRef.current ?? target;
      const next = typeof update === "function" ? update(previous) : update;
      const view = isGlobe ? next : clampFlatView(next, flatTarget, width, height);
      cameraRef.current = view;
      setInteractions((previous) => ({
        ...previous,
        [mode]: { targetKey, view },
      }));
    },
    [target, mode, targetKey, isGlobe, flatTarget, width, height],
  );

  const setZoom = useCallback(
    (view: MapViewState) => {
      if (isGlobe && isGlobeMaxZoom(view, width, height)) {
        const next = clampFlatView({
          ...flatTarget,
          longitude: view.longitude + Math.round((flatTarget.longitude - view.longitude) / 360) * 360,
          latitude: level === "world"
            ? flattenWorldPosition([view.longitude, view.latitude])[1]
            : view.latitude,
          zoom: flatTarget.zoom + 0.5,
          transitionDuration: 0,
        }, flatTarget, width, height);
        setInteractions((previous) => ({
          ...previous,
          [mode]: { targetKey: `${level}:${regionId ?? ""}:${width}:${height}:false`, view: next },
        }));
        cameraRef.current = next;
        setIsGlobe(false);
        return;
      }
      if (!isGlobe && view.zoom <= getWorldZoom(width, height) + 0.001) {
        setIsGlobe(true);
        changeRegion("");
        return;
      }
      setCamera(view);
    },
    [height, isGlobe, setCamera, changeRegion, width, setIsGlobe, flatTarget, mode, level, regionId],
  );
  useEffect(() => {
    const element = container.current;
    if (!element || isGlobe || paused) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
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
      next = {
        ...next,
        longitude: moved.longitude ?? current.longitude,
        latitude: moved.latitude ?? current.latitude,
      };
      setZoom(next);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [paused, height, isGlobe, setZoom, target, width, setIsGlobe, container]);
  useEffect(() => {
    if (!isGlobe || level !== "world" || paused) return;
    let frame = 0;
    let previousTime = 0;
    const rotate = (time: number) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;
      if (
        !interacting.current &&
        Date.now() - lastInteractionAt.current >= 1500
      )
        setCamera((view) => ({
          ...view,
          longitude: view.longitude + elapsed * 0.0007,
          transitionDuration: 0,
        }));
      frame = requestAnimationFrame(rotate);
    };
    frame = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(frame);
  }, [isGlobe, level, paused, setCamera]);
  const markInteraction = useCallback(() => {
    lastInteractionAt.current = Date.now();
  }, []);
  const onInteractionStateChange = useCallback((state: InteractionState) => {
    interacting.current = Boolean(
      state.isDragging ||
      state.isPanning ||
      state.isZooming ||
      state.isRotating ||
      state.inTransition,
    );
    lastInteractionAt.current = Date.now();
  }, []);
  return {
    camera,
    cameraRef,
    target,
    setCamera,
    setZoom,
    markInteraction,
    onInteractionStateChange,
  };
};
