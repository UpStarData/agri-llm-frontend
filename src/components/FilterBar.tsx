import { useShallow } from "zustand/react/shallow";
import { Segmented, Select } from "antd";
import { areaList } from "@vant/area-data";
import { useDashboardStore } from "@/store";
import dayjs, { DISPLAY_TIMEZONE } from "@/utils/date";

const provinces = Object.entries(areaList.province_list).map(
  ([value, label]) => ({ value, label }),
);

const FilterBar = () => {
  const { mode, countryId, provinceId, setFactRegion } =
    useDashboardStore(
      useShallow((s) => ({
        mode: s.mode,
        countryId: s.factFilters.countryId,
        provinceId: s.factFilters.provinceId,
        setFactRegion: s.setFactRegion,
      })),
    );
  return (
    <div className="menu-section menu-region-time">
      {mode === "fact" && (
        <>
          <div className="menu-section-title">区域筛选</div>
          <div className="region-filter-row">
            <Select
              aria-label="筛选国家"
              value={countryId === "CN" ? "CN" : ""}
              options={[
                { value: "", label: "全球" },
                { value: "CN", label: "中国" },
              ]}
              onChange={(id) => setFactRegion(id)}
            />
            <Select
              aria-label="筛选省份"
              placeholder="全部省份"
              value={provinceId || undefined}
              allowClear
              disabled={countryId !== "CN"}
              options={provinces}
              showSearch
              optionFilterProp="label"
              onChange={(id) => setFactRegion(countryId, id)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default FilterBar;

export const FactTimeFilter = () => {
  const { dates, setDateRange } = useDashboardStore(useShallow((s) => ({
    dates: s.dateRange,
    setDateRange: s.setDateRange,
  })));
  const today = dayjs().tz(DISPLAY_TIMEZONE);
  return (
    <Segmented
      className="fact-time-segmented"
      aria-label="事实时间范围"
      value={[1, 7, 30, 180, 365].find(
        (days) =>
          dates[1] === today.format("YYYY-MM-DD") &&
          dates[0] === today.subtract(days - 1, "day").format("YYYY-MM-DD"),
      )}
      options={[
        { value: 1, label: "当天" },
        { value: 7, label: "近7天" },
        { value: 30, label: "近1月" },
        { value: 180, label: "半年" },
        { value: 365, label: "一年" },
      ]}
      onChange={(days) =>
        setDateRange([
          today.subtract(Number(days) - 1, "day").format("YYYY-MM-DD"),
          today.format("YYYY-MM-DD"),
        ])
      }
    />
  );
};
