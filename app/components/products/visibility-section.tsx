import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Separator } from "~/components/ui/separator";

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    badge: { text: "Open access", className: "bg-green-100 text-green-700" },
    label: "Public",
    desc: "Visible to everyone. Any user can browse and subscribe without signing in.",
  },
  {
    value: "authenticated",
    badge: { text: "Sign-in required", className: "bg-blue-100 text-blue-700" },
    label: "Authenticated",
    desc: "Only visible to signed-in users.",
  },
  {
    value: "invisible",
    badge: { text: "Hidden", className: "bg-gray-100 text-gray-600" },
    label: "Invisible",
    desc: "Not visible in the Developer Portal.",
  },
];

interface VisibilitySectionProps {
  visibility: string;
  onVisibilityChange: (value: string) => void;
}

export function VisibilitySection({ visibility, onVisibilityChange }: VisibilitySectionProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-medium text-amber-600">Visibility</h2>
        <Separator className="mt-2" />
      </div>

      <p className="text-sm text-muted-foreground">
        Control who can discover and subscribe to this product in the Developer Portal.
      </p>

      <RadioGroup value={visibility} onValueChange={onVisibilityChange} className="space-y-3">
        {VISIBILITY_OPTIONS.map((opt) => (
          <Label
            key={opt.value}
            htmlFor={`vis-${opt.value}`}
            className={[
              "flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors",
              visibility === opt.value
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
            ].join(" ")}
          >
            <RadioGroupItem value={opt.value} id={`vis-${opt.value}`} className="mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{opt.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${opt.badge.className}`}
                >
                  {opt.badge.text}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{opt.desc}</p>
            </div>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
