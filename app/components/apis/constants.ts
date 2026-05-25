export const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"]

export const METHOD_BG: Record<string, string> = {
  get:     "bg-blue-600",
  post:    "bg-green-600",
  put:     "bg-amber-500",
  delete:  "bg-red-600",
  patch:   "bg-purple-600",
  head:    "bg-zinc-500",
  options: "bg-zinc-500",
}

export const METHOD_BORDER: Record<string, string> = {
  get:    "border-blue-600/40",
  post:   "border-green-600/40",
  put:    "border-amber-500/40",
  delete: "border-red-600/40",
  patch:  "border-purple-600/40",
}
