import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ cursor: 0, pinned: null as string | null }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useId: () => "fact-tools",
  useRef: () => ({ current: null }),
  useEffect: () => {},
  useState: (initial: unknown) => [hooks.cursor++ === 1 ? hooks.pinned : initial, vi.fn()],
}));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector) => selector }));
vi.mock("../src/store", () => ({
  useDashboardStore: (selector) => selector({
    factFilters: {}, setFactFilters: vi.fn(),
    mapOverlayVisibility: {}, setMapOverlayVisibility: vi.fn(),
  }),
}));
import FactMapTools from "../src/components/map/FactMapTools";

beforeEach(() => { hooks.cursor = 0; hooks.pinned = null; });

describe("时间面板的无障碍收起状态", () => {
  it.each([false, true])("面板展开为 %s 时用 inert 控制可交互性，不给聚焦单选框的祖先添加 aria-hidden", (open) => {
    hooks.pinned = open ? "time" : null;
    const tools = FactMapTools({ zoom: null, views: null, fullscreen: null });
    const group = tools.props.children.find((item) => item.key === "time");
    const panel = group.props.children[1];
    expect(panel.props.inert).toBe(!open);
    expect(panel.props["aria-hidden"]).toBeUndefined();
    expect(panel.props["aria-label"]).toBe("时间筛选");
  });
});
