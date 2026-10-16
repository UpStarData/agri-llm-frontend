import { useEffect, useRef } from "react";
import { Button, Empty, Spin, Tag } from "antd";
import { useShallow } from "zustand/react/shallow";
import LayerDrawer from "./LayerDrawer";
import RecordMedia from "@/components/RecordMedia";
import { useDashboardStore } from "@/store";
import type { useRelationQueries } from "@/hooks/useRelationQueries";
import { commodityNameById } from "@/utils/factFilters";
import { useCommodities } from "@/hooks";
import { entityCategoryName } from "@/utils/relationFilters";
import type { EntityCategoryCatalog, EntityListItem } from "@/api/relation";
import type { CommodityItem } from "@/api/commodity";
import type { FactView } from "@/api/fact";

const viewLevelLabels: Record<FactView, string> = {
  global: "全球",
  china: "国内",
  hunan: "湖南",
};

interface IEntityCard extends EntityListItem {
  /** 位置 + 品种拼成的一行副标题 */
  meta: string;
  /** 可见视角文案，如「全球 / 国内」 */
  viewLevels: string;
  /** 卡片最多展示 3 个核心字段 */
  coreFields: { label: string; value: string | number | null }[];
}

/** 卡片展示文案在列表处一次算好，渲染循环里只负责摆放。 */
const entityCard = (
  entity: EntityListItem,
  commodities?: readonly CommodityItem[],
): IEntityCard => {
  const location = entity.geo?.regionPath
    ?.map(({ name }) => name)
    .filter(Boolean)
    .join(" › ");
  const varieties = entity.commodityIds
    ?.map((id) => commodityNameById(id, commodities))
    .filter(Boolean)
    .join("、");
  return {
    ...entity,
    meta: [location, varieties].filter(Boolean).join(" / "),
    viewLevels:
      entity.geo?.viewLevels
        ?.map((level) => viewLevelLabels[level])
        .filter(Boolean)
        .join(" / ") ?? "",
    coreFields:
      entity.typeFields
        ?.filter(({ value }) => value != null && String(value).trim() !== "")
        .slice(0, 3)
        .map(({ label, value }) => ({ label: label?.trim() ?? "", value })) ??
      [],
  };
};

interface IProps {
  list: ReturnType<typeof useRelationQueries>["list"];
  categories?: EntityCategoryCatalog;
  scope: string;
  refresh: () => Promise<unknown>;
}
const EntityList = ({ list, categories, scope, refresh }: IProps) => {
  const commodities = useCommodities();
  const pendingLoad = useRef<HTMLDivElement | null>(null);
  const loadingMore = useRef(false);
  useEffect(() => {
    pendingLoad.current = null;
  }, [scope]);
  useEffect(() => {
    const element = pendingLoad.current;
    if (!element || list.isFetching || loadingMore.current) return;
    pendingLoad.current = null;
    if (
      list.hasNextPage &&
      element.scrollTop > 0 &&
      element.scrollTop + element.clientHeight >= element.scrollHeight - 40
    ) {
      loadingMore.current = true;
      void list.fetchNextPage({ cancelRefetch: false }).finally(() => {
        loadingMore.current = false;
      });
    }
  }, [list]);
  const { selected, open, select } = useDashboardStore(
    useShallow((s) => ({
      selected: s.selection,
      open: s.detailsOpen,
      select: s.select,
    })),
  );
  const records = (list.data?.pages.flatMap(({ items }) => items) ?? []).map(
    (entity) => entityCard(entity, commodities.data),
  );
  const columns = [
    records.filter((_, i) => i % 2 === 0),
    records.filter((_, i) => i % 2 === 1),
  ];
  return (
    <LayerDrawer
      side="right"
      title="本体卡片"
      autoScroll={{
        scope,
        pending: list.isPlaceholderData,
        busy: list.isPending || list.isFetching,
        hasNextPage: !!list.hasNextPage,
        hasRecords: records.length > 0,
        loadMore: async () => {
          if (loadingMore.current || list.isFetching) return;
          loadingMore.current = true;
          try {
            await list.fetchNextPage({ cancelRefetch: false });
          } finally {
            loadingMore.current = false;
          }
        },
        refresh,
      }}
      onScroll={(e) => {
        const element = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = element;
        if (scrollTop <= 0 || scrollTop + clientHeight < scrollHeight - 40) {
          pendingLoad.current = null;
          return;
        }
        if (!list.hasNextPage || loadingMore.current || list.isFetchingNextPage)
          return;
        if (list.isFetching) {
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
            {column.map((card, i) => (
              <div
                key={card.entityId}
                className={`layer-record${open && selected?.kind === "entity" && selected.id === card.entityId ? " is-selected" : ""}`}
                style={{ order: i * 2 + ci }}
                aria-label={`查看本体详情：${card.canonicalName}`}
                onClick={() => select({ kind: "entity", id: card.entityId })}
              >
                {card.category?.categoryId && (
                  <Tag>
                    {entityCategoryName(card.category.categoryId, categories)}
                  </Tag>
                )}
                {card.canonicalName && (
                  <div className="record-title">
                    <strong>{card.canonicalName}</strong>
                  </div>
                )}
                {card.meta && <div className="record-meta">{card.meta}</div>}
                <RecordMedia
                  images={card.imageArr}
                  videos={card.videoArr}
                  alt="本体图片"
                />
                {card.viewLevels && (
                  <div className="record-meta">所在层级：{card.viewLevels}</div>
                )}
                {card.coreFields.map((field, index) => (
                  <div
                    className="record-description"
                    key={`${field.label}-${index}`}
                  >
                    {field.label && `${field.label}：`}
                    {field.value}
                  </div>
                ))}
                {card.relationCount != null && (
                  <span className="record-meta">
                    {card.relationCount} 条关系
                  </span>
                )}
              </div>
            ))}
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
            if (list.isFetching || loadingMore.current) return;
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
