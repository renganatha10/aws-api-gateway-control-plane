import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ForgotPassword from "~/routes/forgot-password";

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

describe("ForgotPassword route", () => {
  it("renders the form when not sent", () => {
    render(<ForgotPassword actionData={undefined} as any />);
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset code" })).toBeInTheDocument();
  });

  it("shows sent confirmation when actionData.sent=true", () => {
    render(
      <ForgotPassword actionData={{ sent: true, email: "user@example.com", error: null }} as any />
    );
    expect(screen.getByText("Check your inbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send reset/ })).not.toBeInTheDocument();
  });

  it("shows error message from actionData", () => {
    render(
      <ForgotPassword actionData={{ sent: false, email: "", error: "Email is required" }} as any />
    );
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("shows Sending… and disables button while submitting", () => {
    mockNavState = "submitting";
    render(<ForgotPassword actionData={undefined} as any />);
    expect(screen.getByText("Sending…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});
