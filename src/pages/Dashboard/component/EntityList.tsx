import { Button, Empty, Spin, Tag } from "antd";
import { useShallow } from "zustand/react/shallow";
import LayerDrawer from "./LayerDrawer";
import { useDashboardStore } from "@/store";
import type { useRelationQueries } from "@/hooks/useRelationQueries";
import { commodityNameById, evidenceStatusLabels } from "@/utils/factFilters";
import { entityCategoryName } from "@/utils/relationFilters";
import { formatDate } from "@/utils/date";
import type { EntityCategoryCatalog } from "@/api/relation";
interface IProps {
  list: ReturnType<typeof useRelationQueries>["list"];
  noCategories: boolean;
  categories?: EntityCategoryCatalog;
}
const EntityList = ({ list, noCategories, categories }: IProps) => {
  const { selected, open, select } = useDashboardStore(
    useShallow((s) => ({
      selected: s.selection,
      open: s.detailsOpen,
      select: s.select,
    })),
  );
  const records = noCategories
    ? []
    : (list.data?.pages.flatMap(({ items }) => items) ?? []);
  const columns = [
    records.filter((_, i) => i % 2 === 0),
    records.filter((_, i) => i % 2 === 1),
  ];
  return (
    <LayerDrawer
      side="right"
      title="本体卡片"
      onScroll={(e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (
          scrollTop > 0 &&
          scrollTop + clientHeight >= scrollHeight - 40 &&
          list.hasNextPage &&
          !list.isFetching
        )
          void list.fetchNextPage();
      }}
    >
      {!noCategories && list.isPending ? (
        <Spin description="正在加载本体卡片" />
      ) : records.length ? (
        columns.map((column, ci) => (
          <div className="layer-record-column" key={ci}>
            {column.map((entity, i) => (
              <button
                type="button"
                key={entity.entityId}
                className={`layer-record${open && selected?.kind === "entity" && selected.id === entity.entityId ? " is-selected" : ""}`}
                style={{ order: i * 2 + ci }}
                aria-label={`查看本体详情：${entity.canonicalName}`}
                onClick={() => select({ kind: "entity", id: entity.entityId })}
              >
                <Tag>
                  {entityCategoryName(
                    entity.category.l2 ?? entity.category.l1 ?? "",
                    categories,
                  )}
                </Tag>
                <div className="record-title">{entity.canonicalName}</div>
                {(entity.geo?.regionPath?.length ||
                  entity.commodityIds?.length) && (
                  <div className="record-meta">
                    {[
                      entity.geo?.regionPath?.at(-1)?.name,
                      entity.commodityIds
                        ?.map((id) => commodityNameById[id] ?? id)
                        .join("、"),
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                )}
                {entity.summary && (
                  <div className="record-description">{entity.summary}</div>
                )}
                {entity.typeFields
                  ?.filter(({ value }) => value !== "" && value != null)
                  .map(({ label, value }) => (
                    <div className="record-description" key={label}>
                      {label}：{value}
                    </div>
                  ))}
                {entity.relationCount !== undefined && (
                  <span className="record-meta">
                    {entity.relationCount} 条关系
                  </span>
                )}
                {(entity.evidenceStatus || entity.sourceType) && (
                  <span className="record-meta">
                    {[
                      entity.evidenceStatus &&
                        (evidenceStatusLabels[entity.evidenceStatus] ?? entity.evidenceStatus),
                      entity.sourceType &&
                        (entity.sourceType === "preset"
                          ? "预置"
                          : entity.sourceType === "fact"
                            ? "事实"
                            : entity.sourceType),
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </span>
                )}
                {entity.updatedAt && (
                  <span className="record-meta">
                    最近更新：{formatDate(entity.updatedAt)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))
      ) : list.isError && !noCategories ? (
        null
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无符合条件的本体"
        />
      )}
      {!noCategories && list.hasNextPage && (
        <Button
          className="record-load-more"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          加载更多
        </Button>
      )}
    </LayerDrawer>
  );
};
export default EntityList;
