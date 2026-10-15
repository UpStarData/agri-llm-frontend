import type { ReactNode } from "react";
import { FactTimeFilter } from "../FilterBar";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Tooltip } from "antd";
import {
  CloseOutlined,
  RadarChartOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { InputRef } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";

const FactMapTools = ({ navigation, fullscreen }: { navigation: ReactNode; fullscreen: ReactNode }) => {
  const { filters, setFilters, influence, setOverlay } =
    useDashboardStore(
      useShallow((s) => ({
        filters: s.factFilters,
        setFilters: s.setFactFilters,
        influence: s.mapOverlayVisibility.influence,
        setOverlay: s.setMapOverlayVisibility,
      })),
    );
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
  return (
    <>
      <div className="fact-controls-row">
      {navigation}
      <Tooltip title="地理影响圆" placement="left">
        <Button
          type={influence ? "primary" : "text"}
          shape="circle"
          icon={<RadarChartOutlined />}
          aria-label="地理影响圆"
          aria-pressed={influence}
          onClick={() => setOverlay("influence", !influence)}
        />
      </Tooltip>
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
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
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
      </div>
      <div className="fact-controls-time"><FactTimeFilter /></div>
    </>
  );
};

export default FactMapTools;
