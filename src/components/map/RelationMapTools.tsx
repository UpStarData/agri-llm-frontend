import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Input, Tooltip, type InputRef } from "antd";
import {
  SearchOutlined,
  CloseOutlined,
  BranchesOutlined,
} from "@ant-design/icons";
import { useDashboardStore } from "@/store";
const RelationMapTools = ({ graph }: { graph: ReactNode }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInput = useRef<InputRef>(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const filters = useDashboardStore((s) => s.relationFilters);
  const setFilters = useDashboardStore((s) => s.setRelationFilters);
  return (
    <>
      <div className="map-search-anchor">
        <Button
          type={searchOpen ? "primary" : "text"}
          shape="circle"
          icon={<SearchOutlined />}
          aria-label="搜索本体"
          aria-expanded={searchOpen}
          aria-pressed={Boolean(filters.keyword)}
          onClick={() => {
            if (!searchOpen) setSearchValue(filters.keyword);
            setSearchOpen((value) => !value);
          }}
        />
        <div
          className={`map-search-panel${searchOpen ? " is-open" : ""}`}
          aria-hidden={!searchOpen}
          inert={!searchOpen}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearchOpen(false);
          }}
        >
          <Input.Search
            ref={searchInput}
            aria-label="按本体名称搜索"
            placeholder="输入本体名称"
            value={searchValue}
            allowClear
            onSearch={(keyword) => setFilters({ keyword: keyword.trim() })}
            onChange={(e) => {
              setSearchValue(e.target.value);
              if (!e.target.value) setFilters({ keyword: "" });
            }}
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            aria-label="退出本体搜索"
            onClick={() => {
              setFilters({ keyword: "" });
              setSearchValue("");
              setSearchOpen(false);
            }}
          />
        </div>
      </div>
      {graph}
      <Tooltip title="跨区域关系">
        <Button type="text" shape="circle" icon={<BranchesOutlined />} aria-label="跨区域关系" aria-pressed={filters.crossRegion} onClick={() => setFilters({ crossRegion: !filters.crossRegion })} />
      </Tooltip>
    </>
  );
};
export default RelationMapTools;
