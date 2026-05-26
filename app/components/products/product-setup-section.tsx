import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";

interface ProductSetupSectionProps {
  productName: string;
  displayName: string;
  description: string;
  onDisplayNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function ProductSetupSection({
  productName,
  displayName,
  description,
  onDisplayNameChange,
  onDescriptionChange,
}: ProductSetupSectionProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-medium text-amber-600">Info</h2>
        <Separator className="mt-2" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prodName">Name</Label>
        <Input
          id="prodName"
          value={productName}
          readOnly
          className="bg-gray-100 text-muted-foreground cursor-default"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="min-h-[140px] resize-y"
        />
      </div>
    </div>
  );
}
