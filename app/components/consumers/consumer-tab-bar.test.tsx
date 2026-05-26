import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ConsumerTabBar } from "~/components/consumers/consumer-tab-bar";

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
}));

describe("ConsumerTabBar", () => {
  it("renders Details and Try Out tabs", () => {
    render(<ConsumerTabBar consumerId={5} activeTab="details" />);
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Try Out")).toBeInTheDocument();
  });

  it("renders Details as plain span (active) and Try Out as link when activeTab=details", () => {
    render(<ConsumerTabBar consumerId={5} activeTab="details" />);
    expect(screen.queryByRole("link", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try Out" })).toHaveAttribute(
      "href",
      "/consumers/5/tryout"
    );
  });

  it("renders Try Out as plain span (active) and Details as link when activeTab=tryout", () => {
    render(<ConsumerTabBar consumerId={5} activeTab="tryout" />);
    expect(screen.queryByRole("link", { name: "Try Out" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "/consumers/5");
  });

  it("uses the correct consumer ID in links", () => {
    render(<ConsumerTabBar consumerId={99} activeTab="details" />);
    expect(screen.getByRole("link", { name: "Try Out" })).toHaveAttribute(
      "href",
      "/consumers/99/tryout"
    );
  });
});
