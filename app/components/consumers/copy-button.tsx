import { Check, Copy } from "lucide-react";

import { useCopy } from "./use-copy";

interface CopyButtonProps {
  value: string;
  size?: "sm" | "xs";
}

export function CopyButton({ value, size = "sm" }: CopyButtonProps) {
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={`text-gray-400 hover:text-gray-700 transition-colors ${size === "xs" ? "p-0.5" : "p-1"}`}
    >
      {copied ? (
        <Check className={size === "xs" ? "size-3" : "size-3.5"} />
      ) : (
        <Copy className={size === "xs" ? "size-3" : "size-3.5"} />
      )}
    </button>
  );
}
