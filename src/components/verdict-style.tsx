import type { Level, Verdict } from "@/lib/verdict";
import { AlertTriangle, CheckCircle, HelpCircle, XCircle } from "./icons";

export const VERDICT_STYLE: Record<
  Verdict["verdict"],
  { label: string; hero: string; chip: string; Icon: (p: { className?: string }) => React.ReactElement }
> = {
  許可: { label: "使用OK", hero: "bg-primary text-white", chip: "bg-ok-soft text-ok-strong", Icon: CheckCircle },
  条件付き許可: { label: "条件付きOK", hero: "bg-caution text-white", chip: "bg-caution-soft text-caution-strong", Icon: AlertTriangle },
  不可: { label: "使用NG", hero: "bg-danger text-white", chip: "bg-danger-soft text-danger-strong", Icon: XCircle },
  判定不能: { label: "判定不能", hero: "bg-stone-600 text-white", chip: "bg-stone-200 text-stone-700", Icon: HelpCircle },
};

export const LEVEL_STYLE: Record<Level, string> = {
  低: "bg-ok-soft text-ok-strong",
  中: "bg-caution-soft text-caution-strong",
  高: "bg-danger-soft text-danger-strong",
  不明: "bg-stone-200 text-stone-700",
};

export function VerdictChip({ verdict }: { verdict: Verdict["verdict"] }) {
  const s = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.chip}`}>
      <s.Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}
