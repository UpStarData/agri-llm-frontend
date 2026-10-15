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
import type { Boundaries, MapLevel, Mode, Position } from "@/types";
import {
  findBoundaryAt,
  getGlobeFitZoom,
  getGlobeZoomLimits,
  getWheelZoomStep,
  getRegionView,
  getWorldZoom,
  GLOBE_MIN_ZOOM,
  GLOBE_WORLD_LATITUDE,
  clampFlatView,
  isGlobeMaxZoom,
} from "@/utils/map";
/** 球体空闲自转：停手 1.5 秒后开始，每秒 6 度（原来 3 度看不出在动）。 */
const AUTO_ROTATE_IDLE = 1500;
const AUTO_ROTATE_SPEED = 0.006;
/**
 * 单帧时间片上限。自转按真实时间推进，这层上限只用来丢掉切后台攒下的时间；
 * 上限给足 250ms，帧率掉到 4fps 以上都不会连带把转速拖慢。
 */
const AUTO_ROTATE_MAX_FRAME = 250;
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
  // 指针是否按住直接听 window：deck.gl 的「手势结束」通知可能收不到
  // （例如手势中途切换投影会重建 DeckGL），只认通知就会永久停转。
  const pointerDown = useRef(false);
  useEffect(() => {
    const press = () => {
      pointerDown.current = true;
    };
    const release = () => {
      pointerDown.current = false;
      lastInteractionAt.current = Date.now();
    };
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
  }, []);
  const transitionUntil = useRef(0);
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
  const projection = useRef(isGlobe);
  const interaction = interactions[mode];
  const camera =
    interaction?.targetKey === targetKey ? interaction.view : target;
  useLayoutEffect(() => {
    cameraRef.current = camera;
    if (projection.current !== isGlobe) {
      projection.current = isGlobe;
      setInteractions((previous) => ({ ...previous, [mode]: undefined }));
    }
  }, [camera, mode, isGlobe]);

  const setCamera = useCallback(
    (update: MapViewState | ((previous: MapViewState) => MapViewState)) => {
      const previous = cameraRef.current ?? target;
      const next = typeof update === "function" ? update(previous) : update;
      const view = isGlobe ? next : clampFlatView(next);
      cameraRef.current = view;
      setInteractions((previous) => ({
        ...previous,
        [mode]: { targetKey, view },
      }));
    },
    [target, mode, targetKey, isGlobe],
  );

  /**
   * 放大到子区域铺满视口时下钻一层：世界→国家→省，和缩小方向的切层对称。
   * 阈值就是该区域被点击聚焦时的缩放，命中哪块由缩放锚点（鼠标下的经纬度）决定。
   */
  const focusChildRegion = useCallback(
    (view: MapViewState, anchor: Position | undefined): boolean => {
      const position: Position = anchor ?? [view.longitude, view.latitude];
      if (level === "world") {
        const countryId = findBoundaryAt(world, position)?.properties.regionId;
        if (!countryId) return false;
        const focus = getRegionView("country", countryId, china, width, height, world);
        if (view.zoom < focus.zoom - 0.001) return false;
        changeRegion(countryId);
        return true;
      }
      // 只有中国有省级边界数据，其他国家的全国视角不再往下钻。
      if (level === "country" && regionId === "CN") {
        const provinceId = findBoundaryAt(china, position)?.properties.regionId;
        if (!provinceId) return false;
        const focus = getRegionView("province", provinceId, china, width, height, world);
        if (view.zoom < focus.zoom - 0.001) return false;
        changeRegion("CN", provinceId);
        return true;
      }
      return false;
    },
    [level, regionId, world, china, width, height, changeRegion],
  );

  const setZoom = useCallback(
    (view: MapViewState, anchor?: Position) => {
      if (Date.now() < transitionUntil.current) return;
      if (isGlobe && isGlobeMaxZoom(view, width, height)) {
        transitionUntil.current = Date.now() + 700;
        changeRegion("");
        setIsGlobe(false);
        return;
      }
      if (!isGlobe) {
        const worldZoom = getWorldZoom(width, height);
        const countryZoom = getRegionView("country", "CN", china, width, height, world).zoom;
        if (level === "province" && view.zoom <= countryZoom + 0.001) {
          transitionUntil.current = Date.now() + 500;
          changeRegion("CN");
          return;
        }
        if (view.zoom <= worldZoom + 0.001) {
          transitionUntil.current = Date.now() + 700;
          if (level === "world") setIsGlobe(true);
          else changeRegion("");
          return;
        }
        if (
          view.zoom > (cameraRef.current ?? target).zoom &&
          focusChildRegion(view, anchor)
        ) {
          transitionUntil.current = Date.now() + 500;
          return;
        }
      }
      setCamera(view);
    },
    [height, isGlobe, setCamera, changeRegion, width, setIsGlobe, level, china, world, target, focusChildRegion],
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
      }).unproject(pointer) as Position;
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
      // 锚点决定放大时聚焦到鼠标下的哪个区域。
      setZoom(next, anchor);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [paused, height, isGlobe, setZoom, target, width, setIsGlobe, container]);
  useEffect(() => {
    if (!isGlobe || paused) return;
    let frame = 0;
    let previousTime = 0;
    const rotate = (time: number) => {
      const elapsed = previousTime
        ? Math.min(time - previousTime, AUTO_ROTATE_MAX_FRAME)
        : 0;
      previousTime = time;
      if (
        !pointerDown.current &&
        Date.now() - lastInteractionAt.current >= AUTO_ROTATE_IDLE
      )
        setCamera((view) => ({
          ...view,
          longitude: view.longitude + elapsed * AUTO_ROTATE_SPEED,
          transitionDuration: 0,
        }));
      frame = requestAnimationFrame(rotate);
    };
    frame = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(frame);
  }, [isGlobe, paused, setCamera]);
  const markInteraction = useCallback(() => {
    lastInteractionAt.current = Date.now();
  }, []);
  const onInteractionStateChange = useCallback((state: InteractionState) => {
    // 受控相机更新也会发出空闲通知，不能把自转帧当作用户操作。
    // 这里只把「正在交互」翻译成一次时间戳刷新，状态位不会卡死自转。
    if (
      state.isDragging ||
      state.isPanning ||
      state.isZooming ||
      state.isRotating ||
      state.inTransition
    )
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
