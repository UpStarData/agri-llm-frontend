import { lazy, Suspense, useMemo } from "react";
import { Spin } from "antd";
import { useShallow } from "zustand/react/shallow";
import DashboardHeader from "@/components/DashboardHeader";
import FactMenu from "@/components/FactMenu";
import RelationMenu from "./component/RelationMenu";
import EntityList from "./component/EntityList";
import RelationContextBar from "./component/RelationContextBar";
import {
  useRelationCatalogs,
  useRelationQueries,
} from "@/hooks/useRelationQueries";
import DetailDrawer from "@/components/DetailDrawer";
import LeftLayerDrawer from "@/components/LeftLayerDrawer";
import RightRecordsDrawer from "@/components/RightRecordsDrawer";
import ProcessingLog from "./component/ProcessingLog";
import { useDashboardStore } from "@/store";
import { useFactList, useFactPoints, useFactTaxonomy } from "@/hooks";
import dayjs, { DISPLAY_TIMEZONE } from "@/utils/date";
import { CardTypes, TimeRange } from "@/api/fact";
import type { FactRequest } from "@/api/fact";
import { compactCategoryIds, provinceApiCode } from "@/utils/factFilters";
import { getFactView } from "@/utils/factView";
import "./index.less";

const MapCanvas = lazy(() => import("@/components/map/MapCanvas"));

const Dashboard = () => {
  const {
    mode,
    relationContext,
    panels,
    excluded,
    countryId,
    provinceId,
    varieties,
    dates,
    keyword,
    videoOnly,
  } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      relationContext: s.relationContext,
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
  const keptCategoryIds = useMemo(
    () => compactCategoryIds(taxonomyQuery.data?.groups ?? [], excluded),
    [excluded, taxonomyQuery.data],
  );
  const today = dayjs().tz(DISPLAY_TIMEZONE);
  const days = [1, 7, 30, 180, 365].find(
    (count) =>
      dates[1] === today.format("YYYY-MM-DD") &&
      dates[0] === today.subtract(count - 1, "day").format("YYYY-MM-DD"),
  );
  const factParams: FactRequest = {
    view: getFactView(countryId, provinceId),
    Province: provinceId ? provinceApiCode(provinceId) : undefined,
    TimeRange: days === undefined ? undefined : ({
      1: TimeRange.Today,
      7: TimeRange.The7D,
      30: TimeRange.The30D,
      180: TimeRange.The180D,
      365: TimeRange.The365D,
    } as Record<number, TimeRange>)[days],
    CategoryIds:
      excluded.length && taxonomyQuery.data
        ? keptCategoryIds
        : undefined,
    CommodityIds: varieties.length ? varieties : undefined,
    Q: keyword || undefined,
    CardTypes: videoOnly ? CardTypes.Video : undefined,
  };
  const noCategories =
    excluded.length > 0 && !!taxonomyQuery.data && keptCategoryIds.length === 0;
  const factsActive = !noCategories;
  const factPoints = useFactPoints(factParams, factsActive);
  const factList = useFactList(factParams, factsActive, countryId, provinceId);
  const relationCatalogs = useRelationCatalogs();
  const relationQueries = useRelationQueries(
    relationCatalogs.categories.data,
    relationCatalogs.types.data,
  );
  const relationGraph = relationQueries.graph.data;
  // 地图接口独立返回地域、跨区域及左侧筛选结果，不混入图谱接口数据。
  const relationMap = relationQueries.map.data;
  const focusEntityIds = useMemo(
    () =>
      relationContext?.rootEntityId
        ? [relationContext.rootEntityId]
        : undefined,
    [relationContext],
  );
  const stageClass = [
    "dashboard-stage",
    `mode-${mode}`,
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
            data={mode === "relation" ? relationMap : undefined}
            graphData={relationGraph}
            relationTypes={relationCatalogs.types.data}
            focusEntityIds={focusEntityIds}
            relationsPending={
              relationQueries.graph.isPending || relationQueries.map.isPending
            }
            factsPending={factPoints.isPending && factsActive}
          />
        </Suspense>
        <LeftLayerDrawer>
          {mode === "fact" ? (
            <FactMenu taxonomyQuery={taxonomyQuery} />
          ) : (
            <RelationMenu
              count={relationQueries.count}
              catalogs={relationCatalogs}
            />
          )}
        </LeftLayerDrawer>
        {mode === "fact" ? (
          <RightRecordsDrawer factList={factList} />
        ) : (
          <EntityList
            list={relationQueries.list}
            scope={relationQueries.listScope}
            refresh={relationQueries.refreshList}
            categories={relationCatalogs.categories.data}
          />
        )}
        {mode === "relation" && <RelationContextBar />}
        <ProcessingLog />
        <DetailDrawer catalogs={relationCatalogs} />
      </div>
    </div>
  );
};

export default Dashboard;
