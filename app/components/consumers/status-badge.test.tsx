import { render, screen } from "@testing-library/react"
import { StatusBadge } from "~/components/consumers/status-badge"

describe("StatusBadge (consumers)", () => {
  it("renders the status code", () => {
    render(<StatusBadge status={200} />)
    expect(screen.getByText("200")).toBeInTheDocument()
  })

  it("applies green styles for 2xx", () => {
    render(<StatusBadge status={201} />)
    expect(screen.getByText("201")).toHaveClass("text-green-700")
  })

  it("applies yellow styles for 3xx", () => {
    render(<StatusBadge status={302} />)
    expect(screen.getByText("302")).toHaveClass("text-yellow-700")
  })

  it("applies orange styles for 4xx", () => {
    render(<StatusBadge status={404} />)
    expect(screen.getByText("404")).toHaveClass("text-orange-700")
  })

  it("applies red styles for 5xx", () => {
    render(<StatusBadge status={500} />)
    expect(screen.getByText("500")).toHaveClass("text-red-700")
  })

  it("renders a colored dot indicator", () => {
    const { container } = render(<StatusBadge status={200} />)
    const dot = container.querySelector(".bg-green-500")
    expect(dot).toBeInTheDocument()
  })

  it("renders a red dot for 5xx", () => {
    const { container } = render(<StatusBadge status={503} />)
    const dot = container.querySelector(".bg-red-500")
    expect(dot).toBeInTheDocument()
  })
})
