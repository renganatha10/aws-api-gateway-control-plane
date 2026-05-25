import { render, screen } from "@testing-library/react"
import { MethodBadge } from "~/components/consumers/method-badge"

describe("MethodBadge (consumers)", () => {
  it("renders the method in uppercase", () => {
    render(<MethodBadge method="get" />)
    expect(screen.getByText("GET")).toBeInTheDocument()
  })

  it("applies blue styles for GET", () => {
    render(<MethodBadge method="get" />)
    expect(screen.getByText("GET")).toHaveClass("text-blue-700")
  })

  it("applies green styles for POST", () => {
    render(<MethodBadge method="post" />)
    expect(screen.getByText("POST")).toHaveClass("text-green-700")
  })

  it("applies yellow styles for PUT", () => {
    render(<MethodBadge method="put" />)
    expect(screen.getByText("PUT")).toHaveClass("text-yellow-700")
  })

  it("applies red styles for DELETE", () => {
    render(<MethodBadge method="delete" />)
    expect(screen.getByText("DELETE")).toHaveClass("text-red-700")
  })

  it("applies fallback gray styles for unknown method", () => {
    render(<MethodBadge method="TRACE" />)
    expect(screen.getByText("TRACE")).toHaveClass("text-gray-700")
  })

  it("is case-insensitive for color lookup", () => {
    render(<MethodBadge method="GET" />)
    expect(screen.getByText("GET")).toHaveClass("text-blue-700")
  })
})
