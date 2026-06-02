import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Login from "~/routes/login";

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

describe("Login route", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test props need dynamic shape
  const loginProps = { loaderData: { mode: "login" }, actionData: undefined } as any;
  // biome-ignore lint/suspicious/noExplicitAny: test props need dynamic shape
  const signupProps = { loaderData: { mode: "signup" }, actionData: undefined } as any;

  it("renders Sign In description in login mode", () => {
    render(<Login {...loginProps} />);
    expect(screen.getByText("Sign in to your workspace")).toBeInTheDocument();
  });

  it("renders email and password fields in login mode", () => {
    render(<Login {...loginProps} />);
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
  });

  it("renders Sign Up description in signup mode", () => {
    render(<Login {...signupProps} />);
    expect(screen.getByText("Create your workspace account")).toBeInTheDocument();
  });

  it("shows first name and last name fields in signup mode", () => {
    render(<Login {...signupProps} />);
    expect(screen.getByLabelText(/First name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last name/i)).toBeInTheDocument();
  });

  it("shows error message from actionData", () => {
    // biome-ignore lint/suspicious/noExplicitAny: test props need dynamic shape
    const errorProps: any = {
      loaderData: { mode: "login" },
      actionData: { error: "Invalid credentials", mode: "login" },
    };
    render(<Login {...errorProps} />);
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("disables submit and shows Signing in… while submitting in login mode", () => {
    mockNavState = "submitting";
    render(<Login {...loginProps} />);
    expect(screen.getByText("Signing in…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });

  it("renders Sign Up link tab", () => {
    render(<Login {...loginProps} />);
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/login?mode=signup"
    );
  });
});
