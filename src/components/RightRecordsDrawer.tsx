import { Button, Empty, Spin, Tag } from "antd";
import { useShallow } from "zustand/react/shallow";
import RecordMedia from "./RecordMedia";
import { useDashboardStore } from "@/store";
import { factCard } from "@/utils/factCard";
import { useCommodities, type useFactList } from "@/hooks";
import LayerDrawer from "@/pages/Dashboard/component/LayerDrawer";

interface IProps {
  factList: ReturnType<typeof useFactList>;
  emptyMessage?: string;
  hasNewFacts?: boolean;
  dismissNewFacts?: () => void;
}
const RightRecordsDrawer = ({
  factList,
  emptyMessage,
  hasNewFacts,
  dismissNewFacts,
}: IProps) => {
  const commodities = useCommodities();
  const { detailsOpen, selected, select } = useDashboardStore(
    useShallow((s) => ({
      detailsOpen: s.detailsOpen,
      selected: s.selection,
      select: s.select,
    })),
  );
  const records = (factList.data?.items ?? []).map((fact) =>
    factCard(fact, commodities.data),
  );
  const columns = [
    records.filter((_, i) => i % 2 === 0),
    records.filter((_, i) => i % 2 === 1),
  ];
  return (
    <LayerDrawer
      side="right"
      title="事实项"
      autoScroll={{
        scope: factList.scope,
        pending: factList.isPlaceholderData,
        busy:
          factList.isFetching ||
          factList.isFetchingNextPage ||
          factList.isPending,
        hasNextPage: factList.hasNextPage,
        hasRecords: records.length > 0,
        loadMore: factList.fetchNextPage,
        refresh: () => factList.refetch({ cancelRefetch: false }),
      }}
      onScroll={(event) => {
        if (!factList.hasNextPage || factList.isFetchingNextPage) return;
        const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
        if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 160)
          void factList.fetchNextPage();
      }}
    >
      {hasNewFacts && (
        <div className="fact-live-notice" role="status">
          <span>有新事实加入</span>
          <Button
            type="text"
            size="small"
            aria-label="关闭新事实提醒"
            onClick={dismissNewFacts}
          >
            ×
          </Button>
        </div>
      )}
      {factList.isPending ? (
        <Spin description="正在加载事实卡片" />
      ) : records.length ? (
        columns.map((column, ci) => (
          <div className="layer-record-column" key={ci}>
            {column.map((card, i) => (
              <div
                className={`layer-record${detailsOpen && selected?.kind === "fact" && selected.id === card.factId ? " is-selected" : ""}`}
                key={card.factId}
                style={{ order: i * 2 + ci }}
                aria-label={`查看事实详情：${card.title}`}
                onClick={() => select({ kind: "fact", id: card.factId })}
              >
                {card.categoryName && <Tag>{card.categoryName}</Tag>}
                <div className="record-title">
                  <strong>{card.title}</strong>
                </div>
                {card.summary && (
                  <div className="record-description">{card.summary}</div>
                )}
                {card.commonFields && (
                  <div className="record-meta">{card.commonFields}</div>
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
                <RecordMedia
                  images={card.imageArr}
                  videos={card.videoArr}
                  alt="事实图片"
                />
                <span className="record-meta">
                  {card.evidenceCount ?? 0} 个来源
                </span>
              </div>
            ))}
          </div>
        ))
      ) : factList.isError || factList.hasNextPage ? null : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={emptyMessage ?? "当前区域和时间范围内暂无事实"}
        />
      )}
      {factList.hasNextPage && (
        <Button
          className="record-load-more"
          loading={factList.isFetchingNextPage}
          onClick={() => void factList.fetchNextPage()}
        >
          加载更多
        </Button>
      )}
    </LayerDrawer>
  );
};
export default RightRecordsDrawer;
