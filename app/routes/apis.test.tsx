import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import ApisPage from "~/routes/apis"

const mockNavigate = vi.fn()

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; className?: string }) =>
      <a href={to} {...props}>{children}</a>,
    useNavigate: () => mockNavigate,
    useNavigation: () => ({ state: "idle" }),
  }
})

const apis = [
  { id: 1, displayName: "Pets API", name: "pets", basePath: "/pets", specType: "openapi3", awsApiId: "abc", createdAt: new Date() },
  { id: 2, displayName: "Stores API", name: "stores", basePath: "/stores", specType: "swagger2", awsApiId: null, createdAt: new Date() },
]

beforeEach(() => mockNavigate.mockClear())

describe("ApisPage route", () => {
  it("renders the APIs heading", () => {
    render(<ApisPage loaderData={{ apis, organisationId: 1 }} as any />)
    expect(screen.getByRole("heading", { name: "APIs" })).toBeInTheDocument()
  })

  it("renders API rows in the table", () => {
    render(<ApisPage loaderData={{ apis, organisationId: 1 }} as any />)
    expect(screen.getByText("Pets API")).toBeInTheDocument()
    expect(screen.getByText("Stores API")).toBeInTheDocument()
  })

  it("shows empty state when no APIs", () => {
    render(<ApisPage loaderData={{ apis: [], organisationId: 1 }} as any />)
    expect(screen.getByText(/No APIs yet/i)).toBeInTheDocument()
  })

  it("renders an Add button to create a new API", () => {
    render(<ApisPage loaderData={{ apis, organisationId: 1 }} as any />)
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument()
  })

  it("renders spec type labels correctly", () => {
    render(<ApisPage loaderData={{ apis, organisationId: 1 }} as any />)
    expect(screen.getByText("OpenAPI 3.0 (REST)")).toBeInTheDocument()
    expect(screen.getByText("OpenAPI 2.0 (REST)")).toBeInTheDocument()
  })
})
