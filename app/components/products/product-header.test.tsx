import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ProductHeader } from "~/components/products/product-header";

vi.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Form: ({
    children,
    ...props
  }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) => (
    <form {...props}>{children}</form>
  ),
}));

const defaults = {
  displayName: "Petstore API Bundle",
  description: "A bundle of pet APIs",
  visibility: "public",
  selectedApiIds: new Set<number>([1, 2]),
  selectedPlanIds: new Set<number>([3]),
  saving: false,
  onPublishClick: vi.fn(),
  onDeleteClick: vi.fn(),
};

describe("ProductHeader", () => {
  it("renders the product name", () => {
    render(<ProductHeader {...defaults} />);
    expect(screen.getByText("Petstore API Bundle")).toBeInTheDocument();
  });

  it("renders breadcrumb link to /products", () => {
    render(<ProductHeader {...defaults} />);
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
  });

  it("renders Save, Publish and Delete buttons", () => {
    render(<ProductHeader {...defaults} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows Saving… and disables Save while saving", () => {
    render(<ProductHeader {...defaults} saving={true} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("includes hidden inputs for all selected API IDs", () => {
    render(<ProductHeader {...defaults} />);
    const apiInputs = document.querySelectorAll('input[name="apiIds"]');
    expect(apiInputs).toHaveLength(2);
    expect((apiInputs[0] as HTMLInputElement).value).toBe("1");
    expect((apiInputs[1] as HTMLInputElement).value).toBe("2");
  });

  it("includes hidden inputs for all selected plan IDs", () => {
    render(<ProductHeader {...defaults} />);
    const planInputs = document.querySelectorAll('input[name="planIds"]');
    expect(planInputs).toHaveLength(1);
    expect((planInputs[0] as HTMLInputElement).value).toBe("3");
  });

  it("calls onPublishClick when Publish is clicked", async () => {
    const onPublishClick = vi.fn();
    render(<ProductHeader {...defaults} onPublishClick={onPublishClick} />);
    await userEvent.click(screen.getByRole("button", { name: /Publish/ }));
    expect(onPublishClick).toHaveBeenCalledOnce();
  });

  it("calls onDeleteClick when Delete is clicked", async () => {
    const onDeleteClick = vi.fn();
    render(<ProductHeader {...defaults} onDeleteClick={onDeleteClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteClick).toHaveBeenCalledOnce();
  });
});
