import { Button, Empty, Spin } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { formatDate } from "@/utils/date";
import type { useFactList } from "@/hooks";
import LayerDrawer from "@/pages/Dashboard/component/LayerDrawer";
interface IProps {
  factList: ReturnType<typeof useFactList>;
  emptyMessage?: string;
}
const RightRecordsDrawer = ({ factList, emptyMessage }: IProps) => {
  const { detailsOpen, selected, select } = useDashboardStore(
    useShallow((s) => ({
      detailsOpen: s.detailsOpen,
      selected: s.selection,
      select: s.select,
    })),
  );
  const records = factList.data?.items ?? [];
  const columns = [
    records.filter((_, i) => i % 2 === 0),
    records.filter((_, i) => i % 2 === 1),
  ];
  return (
    <LayerDrawer
      side="right"
      title="事实项"
      onScroll={(event) => {
        if (!factList.hasNextPage || factList.isFetchingNextPage) return;
        const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
        if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 160)
          void factList.fetchNextPage();
      }}
    >
      {factList.isPending ? (
        <Spin description="正在加载事实卡片" />
      ) : records.length ? (
        columns.map((column, ci) => (
          <div className="layer-record-column" key={ci}>
            {column.map((record, i) => (
              <button
                type="button"
                className={`layer-record${detailsOpen && selected?.kind === "fact" && selected.id === record.factId ? " is-selected" : ""}`}
                key={record.factId}
                style={{ order: i * 2 + ci }}
                aria-label={`查看事实详情：${record.title}`}
                onClick={() => select({ kind: "fact", id: record.factId })}
              >
                <div className="record-title">{record.title}</div>
                <div className="record-meta">
                  {formatDate(record.occurredAt)} /{" "}
                  {record.geo?.regionPath?.at(-1)?.name ?? "-"}
                </div>
                <div className="record-description">
                  {record.summary.slice(0, 50)}
                </div>
                {/* {record.dictLeaf && (
                  <Tag>{record.dictLeaf.split("|").at(-1)}</Tag>
                )} */}
                <span className="record-meta">
                  {record.evidenceCount ?? 0} 个来源
                </span>
              </button>
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
