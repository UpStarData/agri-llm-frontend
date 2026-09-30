export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  title: string;
  options: FilterOption[];
}

export interface FilterSection {
  title: string;
  tone: "blue" | "green" | "cyan" | "coral";
  groups: FilterGroup[];
}

// 三级路径作为选项 ID，避免“港口”“损耗”等同名分类互相影响。
const section = (
  title: string,
  tone: FilterSection["tone"],
  groups: [string, string][],
): FilterSection => ({
  title,
  tone,
  groups: groups.map(([group, labels]) => ({
    title: group,
    options: labels.split("、").map((label) => ({ value: `${title}/${group}/${label}`, label })),
  })),
});

export const factTaxonomy: FilterSection[] = [
  section("自然与生态", "blue", [
    ["天气", "高温、低温、强降雨、干旱、台风、冰雪、异常天气"],
    ["灾害", "洪涝、地震、山火、病虫害、动物疫病"],
    ["资源环境", "水资源、土壤、生态限制、种植适宜度"],
  ]),
  section("生产与供给", "green", [
    ["生产主体", "基地投产、企业扩产、停产、合作社变化"],
    ["生产过程", "播种、种植、养殖、采收、加工、质量"],
    ["投入品", "种苗、饲料、肥料、农药、能源、人工成本"],
    ["产能供给", "面积、产量、可供量、减产、损耗"],
  ]),
  section("流通与供应链", "cyan", [
    ["物流运输", "公路、铁路、港口、航线、运力、时效、阻断"],
    ["仓储冷链", "入库、出库、库存、冷库、损耗、保鲜"],
    ["流向", "产地流出、区域流入、市场到货、渠道分配"],
    ["贸易通关", "进口、出口、海关、检疫、关税、禁限运"],
  ]),
  section("市场与交易", "coral", [
    ["市场主体", "市场、公司、商户、供应商进入或退出"],
    ["价格", "产地价、批发价、零售价、价差、波动"],
    ["交易", "成交、订单、采购、销售、渠道、份额"],
    ["供需", "需求增加、需求下降、供给过剩、供给不足"],
  ]),
  section("消费与舆情", "coral", [
    ["消费行为", "偏好、客群、场景、节庆、替代消费"],
    ["媒体舆情", "新闻、社交讨论、食品安全舆情、品牌舆情"],
    ["品牌产品", "新品、品牌活动、质量评价、产品替代"],
  ]),
  section("政策与治理", "blue", [
    ["农业政策", "产业扶持、补贴、生产规范、储备调控"],
    ["市场监管", "价格监管、食品安全、经营规范、抽检"],
    ["贸易政策", "关税、准入、检疫、双边协议"],
    ["公共治理", "交通管制、重大活动、应急保供"],
  ]),
  section("宏观与公共事件", "cyan", [
    ["宏观环境", "汇率、利率、通胀、能源、国际贸易"],
    ["地缘与安全", "冲突、制裁、政局、公共安全"],
    ["基础设施", "港口、铁路、公路、园区建设"],
    ["技术产业", "农业技术、物流技术、平台技术、替代方案"],
  ]),
];

export const factFilterIds = factTaxonomy.flatMap(({ groups }) =>
  groups.flatMap(({ options }) => options.map(({ value }) => value)));
export const relationFilterIds = ["kind:entity", "kind:relation"];
