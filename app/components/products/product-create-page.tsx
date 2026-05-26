import { Form, Link, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

interface ProductCreatePageProps {
  actionError?: string;
  submitting: boolean;
}

export function ProductCreatePage({ actionError, submitting }: ProductCreatePageProps) {
  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/products" className="hover:underline">
          Products
        </Link>
        {" / New"}
      </div>

      <div className="px-6 pt-2 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">New Product</h1>
      </div>

      <div className="px-6 max-w-xl">
        <Form method="post" className="space-y-5">
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              name="displayName"
              placeholder="e.g. Tracking Product"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe what this product offers…"
              className="min-h-[120px] resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visibility">Visibility</Label>
            <Select name="visibility" defaultValue="authenticated">
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invisible">Invisible</SelectItem>
                <SelectItem value="authenticated">Authenticated</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-black hover:bg-gray-900 text-white px-6"
            >
              {submitting ? "Creating…" : "Create Product"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/products">Cancel</Link>
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
