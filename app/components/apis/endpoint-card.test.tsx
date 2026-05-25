import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EndpointCard } from "~/components/apis/endpoint-card"
import type { ParsedEndpoint } from "~/components/apis/types"

const baseEndpoint: ParsedEndpoint = {
  method: "get",
  path: "/pets",
  summary: "List all pets",
  description: "",
  tags: [],
  parameters: [],
  bodyType: null,
  bodySample: null,
  responses: [{ code: "200", description: "OK" }],
}

describe("EndpointCard", () => {
  it("renders method badge and path", () => {
    render(<EndpointCard ep={baseEndpoint} />)
    expect(screen.getByText("GET")).toBeInTheDocument()
    expect(screen.getByText("/pets")).toBeInTheDocument()
  })

  it("renders summary in the collapsed header", () => {
    render(<EndpointCard ep={baseEndpoint} />)
    expect(screen.getByText("List all pets")).toBeInTheDocument()
  })

  it("does not show response details when collapsed", () => {
    render(<EndpointCard ep={baseEndpoint} />)
    expect(screen.queryByText("Responses")).not.toBeInTheDocument()
  })

  it("expands to show responses on click", async () => {
    render(<EndpointCard ep={baseEndpoint} />)
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.getByText("Responses")).toBeInTheDocument()
    expect(screen.getByText("200")).toBeInTheDocument()
    expect(screen.getByText("OK")).toBeInTheDocument()
  })

  it("collapses again on second click", async () => {
    render(<EndpointCard ep={baseEndpoint} />)
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.getByText("Responses")).toBeInTheDocument()
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.queryByText("Responses")).not.toBeInTheDocument()
  })

  it("shows description when expanded and provided", async () => {
    const ep = { ...baseEndpoint, description: "Returns a list of pets." }
    render(<EndpointCard ep={ep} />)
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.getByText("Returns a list of pets.")).toBeInTheDocument()
  })

  it("shows parameters table when expanded", async () => {
    const ep: ParsedEndpoint = {
      ...baseEndpoint,
      parameters: [{ name: "limit", in: "query", required: false, description: "Max items", type: "integer" }],
    }
    render(<EndpointCard ep={ep} />)
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.getByText("Parameters")).toBeInTheDocument()
    expect(screen.getByText("limit")).toBeInTheDocument()
    expect(screen.getByText("Max items")).toBeInTheDocument()
  })

  it("marks required parameter with asterisk", async () => {
    const ep: ParsedEndpoint = {
      ...baseEndpoint,
      parameters: [{ name: "id", in: "path", required: true, description: "", type: "string" }],
    }
    render(<EndpointCard ep={ep} />)
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.getByText("*")).toBeInTheDocument()
  })

  it("shows request body sample when expanded", async () => {
    const ep: ParsedEndpoint = {
      ...baseEndpoint,
      method: "post",
      bodyType: "application/json",
      bodySample: '{"name":"Fido"}',
    }
    render(<EndpointCard ep={ep} />)
    await userEvent.click(screen.getByText("/pets"))
    expect(screen.getByText('{"name":"Fido"}')).toBeInTheDocument()
  })
})
