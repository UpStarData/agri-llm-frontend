import { useEffect, useRef } from "react";
import { Button, Empty, Spin, Tag } from "antd";
import { useShallow } from "zustand/react/shallow";
import LayerDrawer from "./LayerDrawer";
import { useDashboardStore } from "@/store";
import type { useRelationQueries } from "@/hooks/useRelationQueries";
import { commodityNameById } from "@/utils/factFilters";
import { useEntityListPolling } from "@/hooks/useEntityListPolling";
import { useCommodities } from "@/hooks";
import { entityCategoryName } from "@/utils/relationFilters";
import type { EntityCategoryCatalog } from "@/api/relation";
import type { FactView } from "@/api/fact";

const viewLevelLabels: Record<FactView, string> = {
  global: "全球",
  china: "国内",
  hunan: "湖南",
};

interface IProps {
  list: ReturnType<typeof useRelationQueries>["list"];
  categories?: EntityCategoryCatalog;
  scope: string;
}
const EntityList = ({ list, categories, scope }: IProps) => {
  const commodities = useCommodities();
  const { markActivity, isRefreshing } = useEntityListPolling(list, scope);
  const pendingLoad = useRef<HTMLDivElement | null>(null);
  const loadingMore = useRef(false);
  useEffect(() => { pendingLoad.current = null; }, [scope]);
  useEffect(() => {
    const element = pendingLoad.current;
    if (!element || list.isFetching || isRefreshing() || loadingMore.current) return;
    pendingLoad.current = null;
    if (list.hasNextPage && element.scrollTop > 0 &&
      element.scrollTop + element.clientHeight >= element.scrollHeight - 40) {
      loadingMore.current = true;
      void list.fetchNextPage({ cancelRefetch: false }).finally(() => {
        loadingMore.current = false;
      });
    }
  }, [list, isRefreshing]);
  const { selected, open, select } = useDashboardStore(
    useShallow((s) => ({
      selected: s.selection,
      open: s.detailsOpen,
      select: s.select,
    })),
  );
  const records = list.data?.pages.flatMap(({ items }) => items) ?? [];
  const columns = [
    records.filter((_, i) => i % 2 === 0),
    records.filter((_, i) => i % 2 === 1),
  ];
  return (
    <LayerDrawer
      side="right"
      title="本体卡片"
      onScroll={(e) => {
        markActivity();
        const element = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = element;
        if (scrollTop <= 0 || scrollTop + clientHeight < scrollHeight - 40) {
          pendingLoad.current = null;
          return;
        }
        if (!list.hasNextPage || loadingMore.current || list.isFetchingNextPage) return;
        if (list.isFetching || isRefreshing()) {
          pendingLoad.current = element;
          return;
        }
        loadingMore.current = true;
        void list.fetchNextPage({ cancelRefetch: false }).finally(() => {
          loadingMore.current = false;
        });
      }}
    >
      {list.isPending ? (
        <Spin description="正在加载本体卡片" />
      ) : records.length ? (
        columns.map((column, ci) => (
          <div className="layer-record-column" key={ci}>
            {column.map((entity, i) => {
              const categoryId = entity.category?.categoryId?.trim();
              const name = entity.canonicalName?.trim();
              const location = entity.geo?.regionPath
                ?.map(({ name }) => name?.trim())
                .filter(Boolean)
                .join(" › ");
              const viewLevels = entity.geo?.viewLevels
                ?.map((level) => viewLevelLabels[level])
                .filter(Boolean)
                .join(" / ");
              const varieties = entity.commodityIds
                ?.filter((id) => id?.trim())
                .map((id) => commodityNameById(id, commodities.data)?.trim())
                .filter(Boolean)
                .join("、");
              const meta = [location, varieties].filter(Boolean).join(" / ");
              const coreFields = entity.typeFields
                ?.filter(({ value }) =>
                  value != null &&
                  (typeof value !== "string" || value.trim() !== ""),
                )
                .slice(0, 3);
              return (
                <div
                  key={entity.entityId}
                  className={`layer-record${open && selected?.kind === "entity" && selected.id === entity.entityId ? " is-selected" : ""}`}
                  style={{ order: i * 2 + ci }}
                  aria-label={`查看本体详情：${entity.canonicalName}`}
                  onClick={() => select({ kind: "entity", id: entity.entityId })}
                >
                  {categoryId && (
                    <Tag>分类：{entityCategoryName(categoryId, categories)}</Tag>
                  )}
                  {name && (
                    <div className="record-title"><strong>{name}</strong></div>
                  )}
                  {meta && <div className="record-meta">{meta}</div>}
                  {viewLevels && (
                    <div className="record-meta">所在层级：{viewLevels}</div>
                  )}
                  {coreFields?.map(({ label, value }, index) => (
                    <div className="record-description" key={`${label}-${index}`}>
                      {label?.trim() && `${label.trim()}：`}{value}
                    </div>
                  ))}
                  {entity.relationCount != null && (
                    <span className="record-meta">
                      {entity.relationCount} 条关系
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))
      ) : list.isError ? null : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无符合条件的本体"
        />
      )}
      {list.hasNextPage && (
        <Button
          className="record-load-more"
          loading={list.isFetchingNextPage}
          disabled={list.isFetching && !list.isFetchingNextPage}
          onClick={() => {
            if (list.isFetching || isRefreshing() || loadingMore.current) return;
            loadingMore.current = true;
            void list.fetchNextPage({ cancelRefetch: false }).finally(() => {
              loadingMore.current = false;
            });
          }}
        >
          加载更多
        </Button>
      )}
    </LayerDrawer>
  );
};
export default EntityList;
