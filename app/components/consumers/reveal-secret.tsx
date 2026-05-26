import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

export function RevealSecret({ consumerId }: { consumerId: number }) {
  const fetcher = useFetcher<{ secret?: string; error?: string }>();
  const [visible, setVisible] = useState(false);
  const secret = fetcher.data?.secret;
  const fetchErr = fetcher.data?.error;

  if (fetchErr) {
    return <span className="text-sm text-destructive">{fetchErr}</span>;
  }

  if (!secret) {
    return (
      <button
        type="button"
        onClick={() => fetcher.load(`/api/consumer-secret/${consumerId}`)}
        disabled={fetcher.state === "loading"}
        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        {fetcher.state === "loading" ? "Loading…" : "Show secret"}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-sm text-gray-800 select-all">
        {visible ? secret : "••••••••••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-gray-400 hover:text-gray-700"
        title={visible ? "Hide" : "Show"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  );
}
