import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ProductsPage from "~/routes/products";

const mockNavigate = vi.fn();
let mockLoaderData: any = { products: [], deployments: [] };

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

const products = [
  {
    id: 1,
    displayName: "Petstore Bundle",
    name: "petstore",
    visibility: "public",
    createdAt: new Date(),
  },
  {
    id: 2,
    displayName: "Internal APIs",
    name: "internal",
    visibility: "authenticated",
    createdAt: new Date(),
  },
];
const deployments = [{ id: 1, productId: 1 }];

beforeEach(() => {
  mockNavigate.mockClear();
  mockLoaderData = { products: [], deployments: [] };
});

describe("ProductsPage route", () => {
  it("renders the Products heading", () => {
    render(<ProductsPage />);
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
  });

  it("shows empty state when no products", () => {
    render(<ProductsPage />);
    expect(screen.getByText("No products yet")).toBeInTheDocument();
  });

  it("renders product rows when data is present", () => {
    mockLoaderData = { products, deployments };
    render(<ProductsPage />);
    expect(screen.getByText("Petstore Bundle")).toBeInTheDocument();
    expect(screen.getByText("Internal APIs")).toBeInTheDocument();
  });

  it("renders visibility badges", () => {
    mockLoaderData = { products, deployments };
    render(<ProductsPage />);
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
  });

  it("shows Deployed badge for deployed products", () => {
    mockLoaderData = { products, deployments };
    render(<ProductsPage />);
    expect(screen.getByText("Deployed")).toBeInTheDocument();
  });

  it("renders New Product link", () => {
    render(<ProductsPage />);
    expect(screen.getByRole("link", { name: "New Product" })).toHaveAttribute(
      "href",
      "/products/new"
    );
  });
});
