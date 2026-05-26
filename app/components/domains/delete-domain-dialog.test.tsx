import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DeleteDomainDialog } from "~/components/domains/delete-domain-dialog";

let mockFetcherState = "idle";
let mockFetcherData: Record<string, string> | undefined;

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useFetcher: () => ({
      data: mockFetcherData,
      state: mockFetcherState,
      Form: ({
        children,
        ...props
      }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) => (
        <form {...props}>{children}</form>
      ),
      submit: vi.fn(),
      load: vi.fn(),
    }),
  };
});

beforeEach(() => {
  mockFetcherState = "idle";
  mockFetcherData = undefined;
});

describe("DeleteDomainDialog", () => {
  it("renders nothing when closed", () => {
    render(<DeleteDomainDialog open={false} domainName="api.example.com" onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Delete Domain")).not.toBeInTheDocument();
  });

  it("shows title and domain name when open", () => {
    render(<DeleteDomainDialog open={true} domainName="api.example.com" onOpenChange={vi.fn()} />);
    expect(screen.getByText("Delete Domain")).toBeInTheDocument();
    expect(screen.getByText("api.example.com")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <DeleteDomainDialog open={true} domainName="api.example.com" onOpenChange={onOpenChange} />
    );
    await userEvent.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("includes _intent=delete hidden input", () => {
    render(<DeleteDomainDialog open={true} domainName="api.example.com" onOpenChange={vi.fn()} />);
    const input = document.querySelector('input[name="_intent"]') as HTMLInputElement;
    expect(input?.value).toBe("delete");
  });

  it("shows Deleting… and disables Cancel while submitting", () => {
    mockFetcherState = "submitting";
    render(<DeleteDomainDialog open={true} domainName="api.example.com" onOpenChange={vi.fn()} />);
    expect(screen.getByText("Deleting…")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("shows deleteError when present", () => {
    mockFetcherData = { deleteError: "Something went wrong. Please try again." };
    render(<DeleteDomainDialog open={true} domainName="api.example.com" onOpenChange={vi.fn()} />);
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});
