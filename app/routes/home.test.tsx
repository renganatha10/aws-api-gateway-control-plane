import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import Home from "~/routes/home"

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; className?: string }) =>
      <a href={to} {...props}>{children}</a>,
  }
})

describe("Home route", () => {
  it("renders the hero heading", () => {
    render(<Home />)
    expect(screen.getByText("API Gateway Dashboard")).toBeInTheDocument()
  })

  it("renders stat cards", () => {
    render(<Home />)
    expect(screen.getByText("Total APIs")).toBeInTheDocument()
    expect(screen.getByText("Active Endpoints")).toBeInTheDocument()
    expect(screen.getByText("Avg Latency")).toBeInTheDocument()
    expect(screen.getByText("Uptime")).toBeInTheDocument()
  })

  it("renders quick links to APIs, Environments, and Products", () => {
    render(<Home />)
    const links = screen.getAllByRole("link")
    const hrefs = links.map((l) => l.getAttribute("href"))
    expect(hrefs).toContain("/apis")
    expect(hrefs).toContain("/environments")
    expect(hrefs).toContain("/products")
  })

  it("renders stat values", () => {
    render(<Home />)
    expect(screen.getByText("128")).toBeInTheDocument()
    expect(screen.getByText("99.98%")).toBeInTheDocument()
  })
})
