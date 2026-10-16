import type { ReactNode } from "react";
import { FactTimeFilter } from "../FilterBar";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Input, Tooltip } from "antd";
import {
  CloseOutlined,
  FieldTimeOutlined,
  CompassOutlined,
  RadarChartOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { InputRef } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";

type ToolGroup = "display" | "navigation" | "time";

const FactMapTools = ({ zoom, views, fullscreen }: { zoom: ReactNode; views: ReactNode; fullscreen: ReactNode }) => {
  const { filters, setFilters, influence, setOverlay } =
    useDashboardStore(
      useShallow((s) => ({
        filters: s.factFilters,
        setFilters: s.setFactFilters,
        influence: s.mapOverlayVisibility.influence,
        setOverlay: s.setMapOverlayVisibility,
      })),
    );
  const [hoveredGroup, setHoveredGroup] = useState<ToolGroup | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<ToolGroup | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInput = useRef<InputRef>(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
    setFilters({ keyword: "" });
  };
  const activeGroup = hoveredGroup ?? pinnedGroup;
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) {
        setHoveredGroup(null);
        setPinnedGroup(null);
        setSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const groups: { key: ToolGroup; label: string; icon: ReactNode; content: ReactNode }[] = [
    {
      key: "display",
      label: "搜索与显示",
      icon: <SearchOutlined />,
      content: <>
          <div className="map-search-anchor">
            <form
              className={`map-search-panel${searchOpen ? " is-open" : ""}`}
              aria-hidden={!searchOpen}
              inert={!searchOpen}
              onSubmit={(event) => {
                event.preventDefault();
                setFilters({ keyword: searchValue.trim() });
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSearch();
              }}
            >
              <Input
                ref={searchInput}
                allowClear
                prefix={<SearchOutlined />}
                aria-label="搜索事实"
                placeholder="搜索事实，按回车搜索"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <Button
                type="text"
                htmlType="button"
                icon={<CloseOutlined />}
                aria-label="关闭事实搜索"
                onClick={closeSearch}
              />
            </form>
            <Button
              type={searchOpen ? "primary" : "text"}
              shape="circle"
              icon={<SearchOutlined />}
              aria-label="打开事实搜索"
              aria-expanded={searchOpen}
              aria-pressed={Boolean(filters.keyword)}
              onClick={() => {
                setPinnedGroup("display");
                setHoveredGroup(null);
                if (searchOpen) closeSearch();
                else setSearchOpen(true);
              }}
            />
          </div>
          <Tooltip title="视频" placement="left">
            <Button
              type={filters.videoOnly ? "primary" : "text"}
              shape="circle"
              icon={<VideoCameraOutlined />}
              aria-label="显示视频"
              aria-pressed={filters.videoOnly}
              onClick={() => setFilters({ videoOnly: !filters.videoOnly })}
            />
          </Tooltip>
          {fullscreen}
      </>,
    },
    {
      key: "navigation",
      label: "地图操作",
      icon: <CompassOutlined />,
      content: <>
          {zoom}
          {views}
          <Tooltip title="地理影响圆" placement="top">
            <Button
              type={influence ? "primary" : "text"}
              shape="circle"
              icon={<RadarChartOutlined />}
              aria-label="地理影响圆"
              aria-pressed={influence}
              onClick={() => setOverlay("influence", !influence)}
            />
          </Tooltip>
      </>,
    },
    {
      key: "time",
      label: "时间筛选",
      icon: <FieldTimeOutlined />,
      content: <FactTimeFilter />,
    },
  ];
  return (
    <div
      className="fact-tools"
      ref={toolsRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setHoveredGroup(null);
          setPinnedGroup(null);
          setSearchOpen(false);
        }
      }}
    >
      {groups.map(({ key, label, icon, content }) => {
        const open = activeGroup === key;
        return (
          <div
            key={key}
            className={`fact-tool-group${open ? " is-open" : ""}`}
            onMouseEnter={() => {
              if (!searchOpen) setHoveredGroup(key);
            }}
            onMouseLeave={() => setHoveredGroup(null)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setHoveredGroup(null);
              }
            }}
          >
            <Button
              className="fact-tool-trigger"
              type="text"
              shape="circle"
              icon={icon}
              aria-label={label}
              title={label}
              aria-expanded={open}
              aria-controls={`${panelId}-${key}`}
              onClick={() => {
                setHoveredGroup(null);
                setPinnedGroup(open && pinnedGroup === key ? null : key);
                if (key !== "display" || pinnedGroup === key) setSearchOpen(false);
              }}
            />
            <div
              id={`${panelId}-${key}`}
              className={`fact-tool-panel fact-tool-panel-${key}`}
              role="group"
              aria-label={label}
              aria-hidden={key === "time" ? undefined : !open}
              inert={!open}
            >
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FactMapTools;
