import { Button, Empty, Spin, Tag } from "antd";
import { DoubleRightOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { formatDate } from "@/utils/date";
import type { useFactList } from "@/hooks";
import type { MapData } from "@/types";

const RightRecordsDrawer = ({
  data,
  factList,
}: {
  data?: MapData;
  factList: ReturnType<typeof useFactList>;
}) => {
  const { mode, open, detailsOpen, togglePanel, selected, select } =
    useDashboardStore(
      useShallow((s) => ({
        mode: s.mode,
        open: s.drawerOpen[s.mode].right,
        detailsOpen: s.detailsOpen,
        togglePanel: s.togglePanel,
        selected: s.selection,
        select: s.select,
      })),
    );
  const records =
    mode === "fact"
      ? (factList.data?.items ?? [])
      : [...(data?.entities ?? []), ...(data?.relations ?? [])];
  const columns = [
    records.filter((_, index) => index % 2 === 0),
    records.filter((_, index) => index % 2 === 1),
  ];
  const listTitle = mode === "fact" ? "事实项" : "关联项";
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (mode !== "fact" || !factList.hasNextPage || factList.isFetchingNextPage) return;
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 160) {
      void factList.fetchNextPage();
    }
  };
  return (
    <>
      {!open && (
        <Button
          className="panel-trigger panel-trigger-right"
          type="text"
          icon={<UnorderedListOutlined />}
          aria-label="展开右侧卡片"
          aria-expanded={false}
          aria-controls="layer-records"
          onClick={() => togglePanel("right")}
        >
          {listTitle}
        </Button>
      )}
      <div
        hidden={!open}
        id="layer-records"
        className="layer-drawer layer-drawer-right"
        role="region"
        aria-label={`${listTitle}列表`}
      >
        <div className="layer-drawer-header">
          <div className="record-header-actions">
            <Button
              type="text"
              shape="circle"
              aria-label="收起右侧列表"
              icon={<DoubleRightOutlined />}
              onClick={() => togglePanel("right")}
            />
          </div>
        </div>
        <div
          className="layer-drawer-content layer-record-list"
          onScroll={onScroll}
        >
          {mode === "fact" && factList.isPending ? (
            <Spin description="正在加载事实卡片" />
          ) : records.length ? (
            columns.map((column, columnIndex) => (
              <div className="layer-record-column" key={columnIndex}>
                {column.map((record, index) => {
                  const isFact = "factId" in record;
                  const id = isFact ? record.factId : record.id;
                  return (
                    <button
                      type="button"
                      className={`layer-record${detailsOpen && selected?.id === id ? " is-selected" : ""}`}
                      key={id}
                      style={{ order: index * 2 + columnIndex }}
                      aria-label={`查看${isFact ? "事实" : "关联项"}详情：${isFact ? record.title : "name" in record ? record.name : record.type}`}
                      onClick={() =>
                        select({
                          kind: isFact
                            ? "fact"
                            : "name" in record
                              ? "entity"
                              : "relation",
                          id,
                        })
                      }
                    >
                      <div className="record-title">
                        {isFact
                          ? record.title
                          : "name" in record
                            ? record.name
                            : `${record.sourceId} → ${record.targetId}`}
                      </div>
                      {isFact && (
                        <div className="record-meta">
                          {formatDate(record.occurredAt)} /{" "}
                          {record.geo?.regionPath?.at(-1)?.name ?? "-"}
                        </div>
                      )}
                      {isFact ? (
                        <div className="record-description">
                          {record.summary.slice(0, 50)}
                        </div>
                      ) : record.description ? (
                        <div className="record-description">
                          {record.description.slice(0, 50)}
                        </div>
                      ) : null}
                      {isFact && record.dictLeaf && (
                        <Tag>{record.dictLeaf.split("|").at(-1)}</Tag>
                      )}
                      {isFact && (
                        <span className="record-meta">
                          {record.evidenceCount ?? 0} 个来源
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          ) : mode === "fact" && (factList.isError || factList.hasNextPage) ? null : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                mode === "fact" ? "当前区域和时间范围内暂无事实" : "暂无关联项"
              }
            />
          )}
          {mode === "fact" && factList.hasNextPage && (
            <Button
              className="record-load-more"
              loading={factList.isFetchingNextPage}
              onClick={() => void factList.fetchNextPage()}
            >
              {factList.loadMoreError ? "加载失败，点击重试" : "加载更多"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default RightRecordsDrawer;
