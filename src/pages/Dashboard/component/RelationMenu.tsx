import { useMemo } from "react";
import VarietySelect from "./VarietySelect";
import { Button, Checkbox, Collapse, Space, Spin, Switch } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import type { useRelationCatalogs, useRelationQueries } from "@/hooks/useRelationQueries";
import { relationColor, relationDomainInfo } from "@/utils/relationFilters";
import MapControlSettings from "@/components/MapControlSettings";
interface IProps {
  count: ReturnType<typeof useRelationQueries>["count"];
  catalogs: ReturnType<typeof useRelationCatalogs>;
}
const RelationMenu = ({ count, catalogs }: IProps) => {
  const { entityGroups, entityCategoryIds } = useMemo(() => {
    const entityGroups = catalogs.categories.data?.categories ?? [];
    const entityCategoryIds = entityGroups.flatMap((group) =>
      group.children.map((child) => child.id),
    );
    return { entityGroups, entityCategoryIds };
  }, [catalogs.categories.data]);
  const { relationTypes, relationTypeIds, relationGroups } = useMemo(() => {
    const relationTypes = catalogs.types.data?.types ?? [];
    const relationTypeIds = relationTypes.map((type) => type.id);
    const relationGroups: { domain: string; types: typeof relationTypes }[] = [];
    for (const type of relationTypes) {
      const last = relationGroups.at(-1);
      if (last?.domain === type.colorDomain) last.types.push(type);
      else relationGroups.push({ domain: type.colorDomain, types: [type] });
    }
    return { relationTypes, relationTypeIds, relationGroups };
  }, [catalogs.types.data]);

  const { excluded, filters, setExcluded, setFilters } =
    useDashboardStore(
      useShallow((s) => ({
        excluded: s.excludedFilterIds.relation,
        filters: s.relationFilters,
        setExcluded: s.setExcludedFilterIds,
        setFilters: s.setRelationFilters,
      })),
    );
  const changeGroup = (ids: string[], checked: boolean) =>
    setExcluded(
      "relation",
      checked
        ? excluded.filter((id) => !ids.includes(id))
        : [...new Set([...excluded, ...ids])],
    );
  return (
    <>
      <div className="menu-section">
        <div className="menu-section-title">数据概览</div>
        {count.isPending ? (
          <Spin size="small" />
        ) : (
          <div className="overview-metrics relation-overview-metrics">
            {[
              ["当前本体", count.data?.entityTotal],
              ["今日新增本体", count.data?.todayNewEntities],
              ["今日新增关系", count.data?.todayNewRelations],
            ].map(([label, value], index) => (
              <div
                className={`overview-metric${index === 0 ? " relation-overview-primary" : ""}`}
                key={label}
              >
                <span className={`overview-count${index > 0 ? " overview-count-new" : ""}`}>{value ?? "—"}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="menu-section">
        <div className="drawer-filter-header">
          <div className="menu-section-title">本体分类筛选</div>
          <div className="drawer-filter-actions">
            <Button
              type="link"
              size="small"
              onClick={() => setExcluded("relation", [])}
            >
              全选
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() =>
                setExcluded(
                  "relation",
                  entityCategoryIds.filter((id) => !excluded.includes(id)),
                )
              }
            >
              反选
            </Button>
          </div>
        </div>
        {catalogs.categories.isPending ? <Spin size="small" /> : catalogs.categories.isError && !entityGroups.length ? (
          null
        ) : <Collapse
          ghost
          size="small"
          defaultActiveKey={[entityGroups[0]?.id]}
          items={entityGroups.map(({ id, name, children }, i) => ({
            key: id,
            label: (
              <span
                className={`filter-section-title filter-section-${["blue", "green", "cyan", "coral"][i]}`}
              >
                {name}
              </span>
            ),
            extra: (
              <Checkbox
                aria-label={`选择${name}`}
                checked={children.every(({ id }) => !excluded.includes(id))}
                indeterminate={
                  children.some(({ id }) => !excluded.includes(id)) &&
                  children.some(({ id }) => excluded.includes(id))
                }
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => changeGroup(children.map((child) => child.id), e.target.checked)}
              />
            ),
            children: (
              <div className="drawer-filter-options">
                {children.map((type) => (
                  <Button
                    key={type.id}
                    size="small"
                    title={type.name}
                    className={`filter-chip${excluded.includes(type.id) ? " is-off" : ""}`}
                    aria-pressed={!excluded.includes(type.id)}
                    onClick={() => changeGroup([type.id], excluded.includes(type.id))}
                  >
                    {type.name}
                  </Button>
                ))}
              </div>
            ),
          }))}
        />}
      </div>
      <div className="menu-section">
        <div className="menu-section-title">品种选择</div>
        <VarietySelect />
      </div>
      <div className="menu-section">
        <div className="drawer-filter-header">
          <div className="menu-section-title">关系筛选</div>
          <div className="drawer-filter-actions">
            <Button
              type="link"
              size="small"
              onClick={() => setFilters({ excludedTypes: [] })}
            >
              全选
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() =>
                setFilters({
                  excludedTypes: relationTypeIds.filter(
                    (id) => !filters.excludedTypes.includes(id),
                  ),
                })
              }
            >
              反选
            </Button>
          </div>
        </div>
        {catalogs.types.isPending ? <Spin size="small" /> : catalogs.types.isError && !relationTypes.length ? (
          null
        ) : relationGroups.map(({ domain, types }, groupIndex) => (
          <div className="drawer-filter-group" key={`${domain}-${groupIndex}`}>
            <Space size="small">
              <span style={{ color: `rgb(${relationColor("", undefined, domain).join(",")})` }}>●</span>
              <span className="filter-group-name">{relationDomainInfo[domain]?.name ?? domain}</span>
            </Space>
            <div className="drawer-filter-options">
              {types.map((type) => (
                <Button
                  key={type.id}
                  size="small"
                  className={`filter-chip${filters.excludedTypes.includes(type.id) ? " is-off" : ""}`}
                  aria-pressed={!filters.excludedTypes.includes(type.id)}
                  onClick={() =>
                    setFilters({
                      excludedTypes: filters.excludedTypes.includes(type.id)
                        ? filters.excludedTypes.filter((id) => id !== type.id)
                        : [...filters.excludedTypes, type.id],
                    })
                  }
                >
                  {type.name}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="menu-section">
        <div className="menu-section-title">关系显示</div>
        <div className="drawer-control-header">
          <span>跨区域关系</span>
          <Switch
            size="small"
            aria-label="跨区域关系"
            checked={filters.crossRegion}
            onChange={(crossRegion) => setFilters({ crossRegion })}
          />
        </div>
      </div>
      <MapControlSettings />
    </>
  );
};
export default RelationMenu;
