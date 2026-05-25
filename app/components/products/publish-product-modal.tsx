import { useEffect, useState } from "react"
import { Link, useFetcher } from "react-router"
import { Rocket } from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import type { EnvironmentItem } from "./types"

type PublishData = { publishError?: string; publishOk?: boolean; publishedTo?: string }

interface PublishProductModalProps {
  open: boolean
  product: { id: number; displayName: string }
  environments: EnvironmentItem[]
  onClose: () => void
}

export function PublishProductModal({
  open,
  product,
  environments,
  onClose,
}: PublishProductModalProps) {
  const fetcher = useFetcher()
  const [envId, setEnvId] = useState<string>("")
  const busy = fetcher.state !== "idle"
  const data = fetcher.data as PublishData | undefined
  const error = data?.publishError ?? null
  const succeeded = data?.publishOk === true

  useEffect(() => {
    if (succeeded) {
      const t = setTimeout(onClose, 800)
      return () => clearTimeout(t)
    }
  }, [succeeded, onClose])

  useEffect(() => {
    setEnvId("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Product</DialogTitle>
        </DialogHeader>

        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/80">
            <svg className="size-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">Deploying to AWS…</p>
          </div>
        )}

        {succeeded ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-green-100">
              <svg className="size-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">
              Published to <span className="font-semibold">{data?.publishedTo ?? ""}</span>
            </p>
          </div>
        ) : environments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <p className="text-sm font-medium text-gray-700">No environments found.</p>
            <p className="text-xs text-muted-foreground">
              <Link to="/environments" className="underline underline-offset-2 hover:text-gray-900" onClick={onClose}>
                Create an environment first →
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select an environment to deploy{" "}
              <span className="font-medium text-gray-900">{product.displayName}</span> to:
            </p>
            <RadioGroup value={envId} onValueChange={setEnvId} className="space-y-2">
              {environments.map((env) => (
                <Label
                  key={env.id}
                  htmlFor={`env-${env.id}`}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors",
                    envId === String(env.id)
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <RadioGroupItem value={String(env.id)} id={`env-${env.id}`} />
                  <span className="text-sm font-medium text-gray-900">{env.name}</span>
                </Label>
              ))}
            </RadioGroup>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {!succeeded && environments.length > 0 && (
            <fetcher.Form method="post">
              <input type="hidden" name="_intent" value="publish" />
              <input type="hidden" name="environmentId" value={envId} />
              <Button type="submit" disabled={!envId || busy}>
                <Rocket className="size-4 mr-1.5" />
                Deploy
              </Button>
            </fetcher.Form>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
