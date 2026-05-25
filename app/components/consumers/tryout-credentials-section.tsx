import { useEffect } from "react"
import { useFetcher } from "react-router"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label"
import { CopyButton } from "./copy-button"

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
      {children}
    </h3>
  )
}

interface TryoutCredentialsSectionProps {
  consumerId: number
  tokenUrl: string | null
  token: string
  tokenVisible: boolean
  apiKeyValue: string
  apiKeyVisible: boolean
  onTokenChange: (token: string) => void
  onTokenVisibleToggle: () => void
  onApiKeyVisibleToggle: () => void
}

export function TryoutCredentialsSection({
  consumerId,
  tokenUrl,
  token,
  tokenVisible,
  apiKeyValue,
  apiKeyVisible,
  onTokenChange,
  onTokenVisibleToggle,
  onApiKeyVisibleToggle,
}: TryoutCredentialsSectionProps) {
  const tokenFetcher = useFetcher<{
    access_token?: string
    expires_in?: number
    token_type?: string
    error?: string
  }>()

  useEffect(() => {
    if (tokenFetcher.data?.access_token) {
      onTokenChange(tokenFetcher.data.access_token)
    }
  }, [tokenFetcher.data, onTokenChange])

  return (
    <section className="rounded-lg border border-gray-200 p-5 space-y-4">
      <SectionHeader>Credentials</SectionHeader>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-600">OAuth2 Token</Label>
        {tokenUrl ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs text-gray-400 font-mono truncate max-w-xs"
              title={tokenUrl}
            >
              {tokenUrl}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-3"
              disabled={tokenFetcher.state !== "idle"}
              onClick={() => tokenFetcher.load(`/api/consumer-token/${consumerId}`)}
            >
              {tokenFetcher.state !== "idle" ? "Fetching…" : "Get Token"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No token URL configured.</p>
        )}

        {tokenFetcher.data?.error && (
          <p className="text-xs text-destructive">{tokenFetcher.data.error}</p>
        )}

        {token && (
          <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
            <span className="font-mono text-xs text-gray-800 flex-1 truncate select-all">
              {tokenVisible ? token : "•".repeat(Math.min(token.length, 48))}
            </span>
            <button
              onClick={onTokenVisibleToggle}
              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
            >
              {tokenVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <CopyButton value={token} size="xs" />
          </div>
        )}
      </div>

      {apiKeyValue && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-600">API Key (x-api-key)</Label>
          <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
            <span className="font-mono text-xs text-gray-800 flex-1 truncate select-all">
              {apiKeyVisible ? apiKeyValue : "•".repeat(Math.min(apiKeyValue.length, 32))}
            </span>
            <button
              onClick={onApiKeyVisibleToggle}
              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
            >
              {apiKeyVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <CopyButton value={apiKeyValue} size="xs" />
          </div>
        </div>
      )}
    </section>
  )
}
