import { render, screen } from "@testing-library/react"
import { StatusBadge } from "~/components/apis/status-badge"

describe("StatusBadge (apis)", () => {
  it("renders the code", () => {
    render(<StatusBadge code="200" />)
    expect(screen.getByText("200")).toBeInTheDocument()
  })

  it("applies green styling for 2xx", () => {
    render(<StatusBadge code="201" />)
    expect(screen.getByText("201")).toHaveClass("text-green-400")
  })

  it("applies blue styling for 3xx", () => {
    render(<StatusBadge code="301" />)
    expect(screen.getByText("301")).toHaveClass("text-blue-400")
  })

  it("applies amber styling for 4xx", () => {
    render(<StatusBadge code="404" />)
    expect(screen.getByText("404")).toHaveClass("text-amber-400")
  })

  it("applies red styling for 5xx", () => {
    render(<StatusBadge code="500" />)
    expect(screen.getByText("500")).toHaveClass("text-red-400")
  })
})
