import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dates: null as [string, string] | null,
  setDateRange: vi.fn(),
}));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector) => selector }));
vi.mock("../src/store", () => ({
  useDashboardStore: (selector) => selector({ dateRange: mocks.dates, setDateRange: mocks.setDateRange }),
}));
import { FactTimeFilter } from "../src/components/FilterBar";

describe("事实时间选择", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T04:00:00Z"));
    mocks.setDateRange.mockClear();
    mocks.dates = null;
  });
  afterEach(() => vi.useRealTimers());

  it("全部选项有明确选中态，选择全部清除日期限制", () => {
    mocks.dates = ["2026-10-10", "2026-10-16"];
    const filter = FactTimeFilter();
    expect(filter.props.value).toBe(7);
    filter.props.onChange({ target: { value: "all" } });
    expect(mocks.setDateRange).toHaveBeenCalledWith(null);
    mocks.dates = null;
    expect(FactTimeFilter().props.value).toBe("all");
  });

  it.each([
    [1, "2026-10-16"], [7, "2026-10-10"], [30, "2026-09-17"],
    [180, "2026-04-20"], [365, "2025-10-17"],
  ])("从全部切到 %s 天恢复日期范围和选中态", (value, start) => {
    FactTimeFilter().props.onChange({ target: { value } });
    expect(mocks.setDateRange).toHaveBeenCalledWith([start, "2026-10-16"]);
    mocks.dates = [start, "2026-10-16"];
    expect(FactTimeFilter().props.value).toBe(value);
  });
});
