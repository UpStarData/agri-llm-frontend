import { Button } from "antd";
import type { EvidenceFact } from "@/types";
import { useDashboardStore } from "@/store";
interface IProps {
  facts?: EvidenceFact[] | null;
  factIds?: string[] | null;
  preset?: boolean;
}
const EvidenceFacts = ({ facts, factIds, preset }: IProps) => {
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  return (
    <>
      <div className="detail-section-title">证据与来源</div>
      {!facts?.length && !factIds?.length && !preset && <div>暂无证据事实</div>}
      {preset && <div>来自预置清单</div>}
      {facts?.length
        ? facts.map((fact) => (
            <div key={fact.factId}>
              <Button
                type="link"
                onClick={() => pushDetail({ kind: "fact", id: fact.factId })}
              >
                {fact.title}
              </Button>
              {fact.excerpt && <div>{fact.excerpt}</div>}
            </div>
          ))
        : (factIds ?? []).map((id) => (
            <div key={id}>
              <Button
                type="link"
                onClick={() => pushDetail({ kind: "fact", id })}
              >
                {id}
              </Button>
            </div>
          ))}
    </>
  );
};
export default EvidenceFacts;
