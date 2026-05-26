import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import DomainsPage from "~/routes/domains";

const mockNavigate = vi.fn();
// biome-ignore lint/suspicious/noExplicitAny: test mock needs dynamic shape
let mockLoaderData: any = { domains: [] };

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

const domains = [
  {
    id: 1,
    domainName: "api.example.com",
    endpointType: "REGIONAL",
    awsDomainName: "d-abc.execute-api.amazonaws.com",
    mappingCount: 2,
    createdAt: new Date(),
  },
  {
    id: 2,
    domainName: "api2.example.com",
    endpointType: "EDGE",
    awsDomainName: null,
    mappingCount: 0,
    createdAt: new Date(),
  },
];

beforeEach(() => {
  mockNavigate.mockClear();
  mockLoaderData = { domains: [] };
});

describe("DomainsPage route", () => {
  it("renders the Domains heading", () => {
    render(<DomainsPage />);
    expect(screen.getByRole("heading", { name: "Domains" })).toBeInTheDocument();
  });

  it("shows empty state when no domains", () => {
    render(<DomainsPage />);
    expect(screen.getByText("No custom domains yet")).toBeInTheDocument();
  });

  it("renders domain rows when data is present", () => {
    mockLoaderData = { domains };
    render(<DomainsPage />);
    expect(screen.getByText("api.example.com")).toBeInTheDocument();
    expect(screen.getByText("api2.example.com")).toBeInTheDocument();
  });

  it("renders endpoint type badges", () => {
    mockLoaderData = { domains };
    render(<DomainsPage />);
    expect(screen.getByText("Regional")).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("renders New Domain link", () => {
    render(<DomainsPage />);
    expect(screen.getByRole("link", { name: "New Domain" })).toHaveAttribute(
      "href",
      "/domains/new"
    );
  });
});
