import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ResetPassword from "~/routes/reset-password";

let mockNavState = "idle";

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    Form: ({
      children,
      ...props
    }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) => (
      <form {...props}>{children}</form>
    ),
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
    useNavigation: () => ({ state: mockNavState }),
  };
});

beforeEach(() => {
  mockNavState = "idle";
});

describe("ResetPassword route", () => {
  const loaderData = { email: "user@example.com" };
  // biome-ignore lint/suspicious/noExplicitAny: test props need dynamic shape
  const baseProps = { loaderData, actionData: undefined } as any;

  it("renders the Set new password title", () => {
    render(<ResetPassword {...baseProps} />);
    expect(screen.getByText("Set new password")).toBeInTheDocument();
  });

  it("renders code, new password and confirm password fields", () => {
    render(<ResetPassword {...baseProps} />);
    expect(screen.getByLabelText("Reset code")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("pre-fills email hidden input from loaderData", () => {
    render(<ResetPassword {...baseProps} />);
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
    expect(emailInput?.value).toBe("user@example.com");
  });

  it("shows error from actionData", () => {
    // biome-ignore lint/suspicious/noExplicitAny: test props need dynamic shape
    const errorProps: any = {
      loaderData,
      actionData: { error: "Passwords do not match", email: "user@example.com" },
    };
    render(<ResetPassword {...errorProps} />);
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("shows Resetting… and disables button while submitting", () => {
    mockNavState = "submitting";
    render(<ResetPassword {...baseProps} />);
    expect(screen.getByText("Resetting…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resetting…" })).toBeDisabled();
  });
});
