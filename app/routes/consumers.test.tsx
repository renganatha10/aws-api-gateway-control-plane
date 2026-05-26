import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ConsumersPage from "~/routes/consumers";

const mockNavigate = vi.fn();
// biome-ignore lint/suspicious/noExplicitAny: test mock needs dynamic shape
let mockLoaderData: any = { consumers: [] };

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
    useLoaderData: () => mockLoaderData,
    useNavigate: () => mockNavigate,
  };
});

const consumers = [
  {
    id: 1,
    name: "mobile-app",
    productName: "Petstore",
    environmentName: "prod",
    planName: "gold",
    createdAt: new Date(),
  },
  {
    id: 2,
    name: "web-app",
    productName: "Stores",
    environmentName: "staging",
    planName: "silver",
    createdAt: new Date(),
  },
];

beforeEach(() => {
  mockNavigate.mockClear();
  mockLoaderData = { consumers: [] };
});

describe("ConsumersPage route", () => {
  it("renders the Consumers heading", () => {
    render(<ConsumersPage />);
    expect(screen.getByText("Consumers")).toBeInTheDocument();
  });

  it("shows empty state when no consumers", () => {
    render(<ConsumersPage />);
    expect(screen.getByText("No consumers yet")).toBeInTheDocument();
  });

  it("renders consumer rows when data is present", () => {
    mockLoaderData = { consumers };
    render(<ConsumersPage />);
    expect(screen.getByText("mobile-app")).toBeInTheDocument();
    expect(screen.getByText("web-app")).toBeInTheDocument();
  });

  it("renders product and environment badges", () => {
    mockLoaderData = { consumers };
    render(<ConsumersPage />);
    expect(screen.getByText("Petstore")).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
  });

  it("renders New Consumer button", () => {
    render(<ConsumersPage />);
    expect(screen.getByRole("link", { name: "New Consumer" })).toHaveAttribute(
      "href",
      "/consumers/new"
    );
  });
});
