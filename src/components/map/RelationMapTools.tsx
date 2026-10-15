import { useState } from "react";
import { Button, Input, Tooltip } from "antd";
import {
  SearchOutlined,
  CloseOutlined,
  BranchesOutlined,
} from "@ant-design/icons";
import { useDashboardStore } from "@/store";
const RelationMapTools = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const filters = useDashboardStore((s) => s.relationFilters);
  const setFilters = useDashboardStore((s) => s.setRelationFilters);
  return (
    <>
      <div className="map-search-anchor">
        <Button
          type="text"
          shape="circle"
          icon={<SearchOutlined />}
          aria-label="搜索本体"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((value) => !value)}
        />
        {searchOpen && (
          <div className="map-search-panel is-open">
            <Input.Search
              autoFocus
              aria-label="按本体名称搜索"
              placeholder="输入本体名称"
              defaultValue={filters.keyword}
              allowClear
              onSearch={(keyword) => setFilters({ keyword: keyword.trim() })}
              onChange={(e) => {
                if (!e.target.value) setFilters({ keyword: "" });
              }}
            />
            <Button
              type="text"
              icon={<CloseOutlined />}
              aria-label="退出本体搜索"
              onClick={() => {
                setFilters({ keyword: "" });
                setSearchOpen(false);
              }}
            />
          </div>
        )}
      </div>
      <Tooltip title="跨区域关系">
        <Button type="text" shape="circle" icon={<BranchesOutlined />} aria-label="跨区域关系" aria-pressed={filters.crossRegion} onClick={() => setFilters({ crossRegion: !filters.crossRegion })} />
      </Tooltip>
    </>
  );
};
export default RelationMapTools;
