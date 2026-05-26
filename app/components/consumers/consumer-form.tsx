import { Form } from "react-router";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ConsumerCredentials } from "./consumer-credentials";
import type { ConsumerItem, EnvironmentOption, PlanOption, ProductOption } from "./types";

interface ConsumerFormProps {
  consumer: ConsumerItem;
  products: ProductOption[];
  environments: EnvironmentOption[];
  plans: PlanOption[];
}

export function ConsumerForm({ consumer, products, environments, plans }: ConsumerFormProps) {
  return (
    <Form method="post" id="consumer-form" className="flex flex-col flex-1 min-h-0 overflow-auto">
      <input type="hidden" name="_intent" value="update" />
      <div className="flex flex-col gap-6 px-6 py-6 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="name">Consumer Name</Label>
          <Input id="name" name="name" defaultValue={consumer.name} required className="max-w-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="productId">Product</Label>
          <Select name="productId" defaultValue={String(consumer.productId)} required>
            <SelectTrigger className="max-w-sm" id="productId">
              <SelectValue placeholder="Select a product…" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="environmentId">Stage</Label>
          <Select name="environmentId" defaultValue={String(consumer.environmentId)} required>
            <SelectTrigger className="max-w-sm" id="environmentId">
              <SelectValue placeholder="Select a stage…" />
            </SelectTrigger>
            <SelectContent>
              {environments.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="planId">Plan</Label>
          <Select name="planId" defaultValue={String(consumer.planId)} required>
            <SelectTrigger className="max-w-sm" id="planId">
              <SelectValue placeholder="Select a plan…" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ConsumerCredentials consumer={consumer} />
      </div>
    </Form>
  );
}
