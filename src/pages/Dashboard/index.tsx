import { lazy, Suspense } from "react";
import { Spin } from "antd";
import { useShallow } from "zustand/react/shallow";
import DashboardHeader from "@/components/DashboardHeader";
import DetailDrawer from "@/components/DetailDrawer";
import LeftLayerDrawer from "@/components/LeftLayerDrawer";
import RightRecordsDrawer from "@/components/RightRecordsDrawer";
import ProcessingLog from "./component/ProcessingLog";
import { useDashboardStore } from "@/store";
import { useFactList, useFactPoints, useFactTaxonomy } from "@/hooks";
import dayjs, { DISPLAY_TIMEZONE } from "@/utils/date";
import { CardTypes, TimeRange } from "@/api/fact";
import type { FactRequest } from "@/api/fact";
import { provinceApiCode, varietyCommodityIds } from "@/utils/factFilters";
import { getFactView } from "@/utils/factView";
import "./index.less";

const MapCanvas = lazy(() => import("@/components/MapCanvas"));

const Dashboard = () => {
  const { panels, excluded, countryId, provinceId, varieties, dates, keyword, videoOnly } =
    useDashboardStore(
      useShallow((s) => ({
        panels: s.drawerOpen[s.mode],
        excluded: s.excludedFilterIds.fact,
        countryId: s.factFilters.countryId,
        provinceId: s.factFilters.provinceId,
        varieties: s.factFilters.varieties,
        keyword: s.factFilters.keyword,
        videoOnly: s.factFilters.videoOnly,
        dates: s.dateRange,
      })),
    );
  const taxonomyQuery = useFactTaxonomy();
  const selected: string[] = [];
  if (excluded.length) {
    for (const group of taxonomyQuery.data?.groups ?? []) {
      for (const category of group.categories) {
        for (const type of category.types) {
          if (!excluded.includes(type.key)) selected.push(type.key);
        }
      }
    }
  }
  const today = dayjs().tz(DISPLAY_TIMEZONE);
  const days = [1, 7, 30].find(
    (count) =>
      dates[1] === today.format("YYYY-MM-DD") &&
      dates[0] === today.subtract(count - 1, "day").format("YYYY-MM-DD"),
  );
  const factParams: FactRequest = {
    view: getFactView(countryId, provinceId),
    Province: provinceId ? provinceApiCode(provinceId) : undefined,
    TimeRange:
      days === 1
        ? TimeRange.Today
        : days === 30
          ? TimeRange.The30D
          : days === 7
            ? TimeRange.The7D
            : undefined,
    LeafKeys:
      excluded.length && taxonomyQuery.data ? [...new Set(selected)] : undefined,
    CommodityId: varieties[0] ? varietyCommodityIds[varieties[0]] : undefined,
    Q: keyword || undefined,
    CardTypes: videoOnly ? CardTypes.Video : undefined,
  };
  const noCategories =
    excluded.length > 0 && !!taxonomyQuery.data && selected.length === 0;
  const factPoints = useFactPoints(factParams, !noCategories);
  const factList = useFactList(factParams, !noCategories, countryId, provinceId);
  const stageClass = [
    "dashboard-stage",
    panels.right && "right-panel-open",
    panels.bottom ? "log-panel-open" : "log-panel-collapsed",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="dashboard">
      <DashboardHeader />
      <div className={stageClass}>
        <Suspense
          fallback={
            <div className="map-status">
              <Spin />
            </div>
          }
        >
          <MapCanvas
            points={factPoints.data}
            factsPending={factPoints.isPending && !noCategories}
          />
        </Suspense>
        <LeftLayerDrawer taxonomyQuery={taxonomyQuery} />
        <RightRecordsDrawer factList={factList} />
        <ProcessingLog />
        <DetailDrawer />
      </div>
    </div>
  );
};

export default Dashboard;
