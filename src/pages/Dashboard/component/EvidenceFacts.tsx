import { Button } from "antd";
import type { EvidenceFact } from "@/types";
import { useDashboardStore } from "@/store";
import { DetailSection } from "./DetailLayout";

interface IProps {
  facts?: EvidenceFact[] | null;
  factIds?: string[] | null;
  preset?: boolean;
}
const EvidenceFacts = ({ facts, factIds, preset }: IProps) => {
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  const count = facts?.length || factIds?.length || 0;
  return (
    <DetailSection title="支撑事实" hint={count ? `${count} 条` : undefined}>
      {preset && <p className="detail-empty">来自预置清单</p>}
      {!count && !preset && <p className="detail-empty">暂无证据事实</p>}
      {facts?.length
        ? facts.map((fact) => (
            <article className="detail-evidence-card" key={fact.factId}>
              <Button
                className="detail-evidence-link"
                type="link"
                onClick={() => pushDetail({ kind: "fact", id: fact.factId })}
              >
                {fact.title}
              </Button>
              {fact.excerpt && <p>{fact.excerpt}</p>}
            </article>
          ))
        : (factIds ?? []).map((id) => (
            <article className="detail-evidence-card" key={id}>
              <Button
                className="detail-evidence-link"
                type="link"
                onClick={() => pushDetail({ kind: "fact", id })}
              >
                {id}
              </Button>
            </article>
          ))}
    </DetailSection>
  );
};
export default EvidenceFacts;
