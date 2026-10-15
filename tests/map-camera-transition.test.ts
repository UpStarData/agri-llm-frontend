import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobeZoomLimits, getRegionView } from "../src/utils/map";

const effects = vi.hoisted(() => [] as (() => unknown)[]);

// 隔离浏览器事件，验证层级切换、滚轮缓冲及动画帧。
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, () => {}],
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => unknown) => effects.push(effect),
  useLayoutEffect: () => {},
}));
import { useMapCamera } from "../src/hooks/useMapCamera";

const options = {
  mode: "fact" as const,
  width: 1440,
  height: 900,
  container: { current: null },
  setIsGlobe: vi.fn(),
  changeRegion: vi.fn(),
};
const worldView = getRegionView("world", undefined, undefined, options.width, options.height);
const countryView = getRegionView("country", "CN", undefined, options.width, options.height);

beforeEach(() => {
  vi.clearAllMocks();
  effects.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("地图缩放层级切换", () => {

  it("省级缩小到全国阈值时回到中国，不直接进入球体", () => {
    const camera = useMapCamera({ ...options, level: "province", regionId: "430000", isGlobe: false });
    camera.setZoom({ ...countryView, zoom: countryView.zoom + 0.1 });
    expect(options.changeRegion).not.toHaveBeenCalled();
    camera.setZoom(countryView);
    expect(options.changeRegion).toHaveBeenCalledWith("CN");
    expect(options.setIsGlobe).not.toHaveBeenCalled();
    camera.setZoom(worldView);
    expect(options.changeRegion).toHaveBeenCalledTimes(1);
  });

  it("全国缩小到全球阈值时先进入二维全球", () => {
    const camera = useMapCamera({ ...options, level: "country", regionId: "CN", isGlobe: false });
    camera.setZoom(worldView);
    expect(options.changeRegion).toHaveBeenCalledWith("");
    expect(options.setIsGlobe).not.toHaveBeenCalled();
  });

  it("二维全球继续缩小时切换球体，并阻止同一滚轮连续触发", () => {
    const camera = useMapCamera({ ...options, level: "world", isGlobe: false });
    camera.setZoom(worldView);
    camera.setZoom(worldView);
    expect(options.setIsGlobe).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("球体放大到阈值时清除区域筛选并进入二维全球", () => {
    const camera = useMapCamera({ ...options, level: "country", regionId: "CN", isGlobe: true });
    const { maxZoom } = getGlobeZoomLimits(options.width, options.height, countryView.latitude);
    camera.setZoom({ ...countryView, zoom: maxZoom });
    expect(options.changeRegion).toHaveBeenCalledExactlyOnceWith("");
    expect(options.setIsGlobe).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe("球体自转", () => {
  it.each(["world", "country"] as const)("%s 视角的空闲通知不会阻止自转", (level) => {
    let frame: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const camera = useMapCamera({ ...options, level, isGlobe: true });
    effects.forEach((effect) => effect());
    camera.onInteractionStateChange({ isDragging: false });
    frame!(16);
    camera.onInteractionStateChange({ isDragging: false });
    frame!(32);
    expect(camera.cameraRef.current!.longitude).toBeGreaterThan(camera.target.longitude);
  });

  it("拖动时暂停，结束 1.5 秒后恢复自转", () => {
    let frame: FrameRequestCallback;
    let now = 10_000;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const camera = useMapCamera({ ...options, level: "world", isGlobe: true });
    effects.forEach((effect) => effect());
    camera.onInteractionStateChange({ isDragging: true });
    frame!(16);
    expect(camera.cameraRef.current).toBeUndefined();
    camera.onInteractionStateChange({ isDragging: false });
    now += 1499;
    frame!(32);
    expect(camera.cameraRef.current).toBeUndefined();
    now += 1;
    frame!(48);
    expect(camera.cameraRef.current!.longitude).toBeGreaterThan(camera.target.longitude);
  });
});
