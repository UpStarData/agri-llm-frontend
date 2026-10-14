import { useLayoutEffect, useRef } from "react";
import type { ReactNode, UIEventHandler } from "react";
import { Button } from "antd";
import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  MenuUnfoldOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useRecordAutoScroll } from "@/hooks/useRecordAutoScroll";
import type { RecordAutoScrollOptions } from "@/hooks/useRecordAutoScroll";
import { useDashboardStore } from "@/store";

interface IProps {
  side: "left" | "right";
  title: string;
  children: ReactNode;
  onScroll?: UIEventHandler<HTMLDivElement>;
  autoScroll?: RecordAutoScrollOptions;
}
const LayerDrawer = ({ side, title, children, onScroll, autoScroll }: IProps) => {
  const content = useRef<HTMLDivElement>(null);
  const mode = useDashboardStore((s) => s.mode);
  useLayoutEffect(() => {
    if (side === "right" && content.current)
      content.current.scrollTop =
        useDashboardStore.getState().recordScroll[mode];
  }, [mode, side]);
  const open = useDashboardStore((s) => s.drawerOpen[s.mode][side]);
  const detailsOpen = useDashboardStore((s) => s.detailsOpen);
  useRecordAutoScroll(content, side === "right" && open && !detailsOpen, autoScroll);
  const togglePanel = useDashboardStore((s) => s.togglePanel);
  const id = side === "left" ? "layer-menu" : "layer-records";
  return (
    <>
      {!open && (
        <Button
          className={`panel-trigger panel-trigger-${side}`}
          type="text"
          icon={
            side === "left" ? <MenuUnfoldOutlined /> : <UnorderedListOutlined />
          }
          aria-label={`展开${title}`}
          aria-expanded={false}
          aria-controls={id}
          onClick={() => togglePanel(side)}
        >
          {title}
        </Button>
      )}
      <div
        hidden={!open}
        id={id}
        className={`layer-drawer layer-drawer-${side}`}
        role="region"
        aria-label={title}
      >
        <div className="layer-drawer-header">
          <Button
            type="text"
            shape="circle"
            aria-label={`收起${title}`}
            icon={
              side === "left" ? <DoubleLeftOutlined /> : <DoubleRightOutlined />
            }
            onClick={() => togglePanel(side)}
          />
        </div>
        <div
          className={`layer-drawer-content${side === "right" ? " layer-record-list" : ""}`}
          ref={content}
          onScroll={(event) => {
            if (side === "right")
              useDashboardStore
                .getState()
                .setRecordScroll(mode, event.currentTarget.scrollTop);
            onScroll?.(event);
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
export default LayerDrawer;
