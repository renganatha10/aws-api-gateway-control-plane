import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Home from "~/routes/home";

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
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
  };
});

describe("Home route", () => {
  it("renders the hero heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "API Gateway Control Panel" })).toBeInTheDocument();
  });

  it("renders Quick Access section", () => {
    render(<Home />);
    expect(screen.getByText("Quick Access")).toBeInTheDocument();
  });

  it("renders quick links to APIs, Products, and Consumers", () => {
    render(<Home />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/apis");
    expect(hrefs).toContain("/products");
    expect(hrefs).toContain("/consumers");
  });

  it("renders quick link card titles", () => {
    render(<Home />);
    expect(screen.getByText("APIs")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Consumers")).toBeInTheDocument();
  });
});
