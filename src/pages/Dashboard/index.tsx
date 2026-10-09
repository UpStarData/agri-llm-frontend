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
import { filterRelationGraph } from "@/utils/relationFilters";
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

const MapCanvas = lazy(() => import("@/components/map/MapCanvas"));

const Dashboard = () => {
  const {
    mode,
    relationFilters,
    relationContext,
    relationExcluded,
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
      relationFilters: s.relationFilters,
      relationContext: s.relationContext,
      relationExcluded: s.excludedFilterIds.relation,
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
  const selected = useMemo(() => {
    if (!excluded.length) return [];
    const excludedKeys = new Set(excluded);
    return (taxonomyQuery.data?.groups ?? []).flatMap((group) =>
      group.categories.flatMap((category) =>
        category.types
          .filter((type) => !excludedKeys.has(type.key))
          .map((type) => type.key),
      ),
    );
  }, [excluded, taxonomyQuery.data]);
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
      excluded.length && taxonomyQuery.data
        ? [...new Set(selected)]
        : undefined,
    CommodityId: varieties[0] ? varietyCommodityIds[varieties[0]] : undefined,
    Q: keyword || undefined,
    CardTypes: videoOnly ? CardTypes.Video : undefined,
  };
  const noCategories =
    excluded.length > 0 && !!taxonomyQuery.data && selected.length === 0;
  const factsActive = !noCategories && varieties.length <= 1;
  const factPoints = useFactPoints(factParams, factsActive);
  const factList = useFactList(factParams, factsActive, countryId, provinceId);
  const relationCatalogs = useRelationCatalogs();
  const relationQueries = useRelationQueries(relationCatalogs.categories.data);
  const { relationGraph, relationMap } = useMemo(() => {
    const relationGraph = filterRelationGraph(
      relationQueries.graph.data?.entities ?? [],
      relationQueries.graph.data?.relations ?? [],
      relationExcluded,
      relationFilters.excludedTypes,
      relationQueries.commodityIds,
      relationFilters.keyword,
      relationCatalogs.categories.data,
      relationCatalogs.types.data,
    );
    const relationMapPoints = filterRelationGraph(
      relationQueries.map.data?.entities ?? [],
      relationQueries.map.data?.relations ?? [],
      relationExcluded,
      relationFilters.excludedTypes,
      relationQueries.commodityIds,
      relationFilters.keyword,
      relationCatalogs.categories.data,
      relationCatalogs.types.data,
    );
    const pointIds = new Set(
      relationMapPoints.entities.map((entity) => entity.id),
    );
    const crossEdges = relationFilters.crossRegion
      ? relationGraph.relations.filter(
          (relation) =>
            pointIds.has(relation.sourceId) || pointIds.has(relation.targetId),
        )
      : [];
    const crossEndpointIds = new Set(
      crossEdges.flatMap((relation) => [relation.sourceId, relation.targetId]),
    );
    const relationMap = {
      entities: [
        ...relationMapPoints.entities,
        ...relationGraph.entities.filter(
          (entity) =>
            crossEndpointIds.has(entity.id) && !pointIds.has(entity.id),
        ),
      ],
      relations: [
        ...new Map(
          [...relationMapPoints.relations, ...crossEdges].map((relation) => [
            relation.id,
            relation,
          ]),
        ).values(),
      ],
    };
    return { relationGraph, relationMap };
  }, [
    relationQueries.graph.data,
    relationQueries.map.data,
    relationExcluded,
    relationFilters,
    relationQueries.commodityIds,
    relationCatalogs.categories.data,
    relationCatalogs.types.data,
  ]);
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
          <RightRecordsDrawer
            factList={factList}
            emptyMessage={
              varieties.length > 1 ? "请选择一个品种查看事实" : undefined
            }
          />
        ) : (
          <EntityList
            list={relationQueries.list}
            noCategories={relationQueries.noCategories}
            categories={relationCatalogs.categories.data}
          />
        )}
        {mode === "relation" && <RelationContextBar />}
        <ProcessingLog />
        <DetailDrawer />
      </div>
    </div>
  );
};

export default Dashboard;
