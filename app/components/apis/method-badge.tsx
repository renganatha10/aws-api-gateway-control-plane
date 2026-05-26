import { METHOD_BG } from "./constants";

export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white min-w-[52px] ${METHOD_BG[method] ?? "bg-zinc-600"}`}
    >
      {method.toUpperCase()}
    </span>
  );
}
