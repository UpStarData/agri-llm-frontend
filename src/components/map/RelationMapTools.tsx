import { useState } from "react";
import { Button, Input } from "antd";
import {
  SearchOutlined,
  CloseOutlined,
  PushpinOutlined,
} from "@ant-design/icons";
import { useDashboardStore } from "@/store";
const RelationMapTools = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const filters = useDashboardStore((s) => s.relationFilters);
  const setFilters = useDashboardStore((s) => s.setRelationFilters);
  const ports = useDashboardStore((s) => s.mapOverlayVisibility.ports);
  const visibility = useDashboardStore((s) => s.mapControlVisibility);
  const setOverlay = useDashboardStore((s) => s.setMapOverlayVisibility);
  return (
    <>
      {visibility.ports && (
        <Button
          type={ports ? "primary" : "text"}
          shape="circle"
          icon={<PushpinOutlined />}
          aria-label="港口锚点"
          aria-pressed={ports}
          onClick={() => setOverlay("ports", !ports)}
        />
      )}
      {visibility.search && (
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
      )}
    </>
  );
};
export default RelationMapTools;
