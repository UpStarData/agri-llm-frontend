import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EvidenceFacts from "../src/pages/Dashboard/component/EvidenceFacts";

describe("证据缺省数据", () => {
  it("缺少 factIds/evidence 或返回 null 均不会使详情崩溃", () => {
    expect(renderToStaticMarkup(<EvidenceFacts />)).toContain("暂无证据事实");
    expect(
      renderToStaticMarkup(<EvidenceFacts facts={null} factIds={null} />),
    ).toContain("暂无证据事实");
    expect(renderToStaticMarkup(<EvidenceFacts preset />)).toContain(
      "来自预置清单",
    );
  });
  it("有证据标题优先展示，只有 ID 时仍提供事实入口", () => {
    expect(
      renderToStaticMarkup(
        <EvidenceFacts facts={[{ factId: "f1", title: "证据标题" }]} />,
      ),
    ).toContain("证据标题");
    expect(renderToStaticMarkup(<EvidenceFacts factIds={["f1"]} />)).toContain(
      "f1",
    );
  });
});
