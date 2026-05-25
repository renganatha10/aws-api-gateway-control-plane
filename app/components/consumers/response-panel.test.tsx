import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ResponsePanel } from "~/components/consumers/response-panel"
import type { ProxyResponse } from "~/components/consumers/tryout-types"

const base200: ProxyResponse = {
  httpStatus: 200,
  statusText: "OK",
  resHeaders: { "content-type": "text/plain", "x-request-id": "abc" },
  resBody: "Hello world",
  ms: 42,
}

describe("ResponsePanel", () => {
  it("renders the HTTP status code", () => {
    render(<ResponsePanel data={base200} />)
    expect(screen.getByText("200")).toBeInTheDocument()
  })

  it("renders statusText and duration", () => {
    render(<ResponsePanel data={base200} />)
    expect(screen.getByText("OK")).toBeInTheDocument()
    expect(screen.getByText("42ms")).toBeInTheDocument()
  })

  it("renders the response body", () => {
    render(<ResponsePanel data={base200} />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("shows header count in toggle button", () => {
    render(<ResponsePanel data={base200} />)
    expect(screen.getByText(/Response headers \(2\)/)).toBeInTheDocument()
  })

  it("headers are hidden initially", () => {
    render(<ResponsePanel data={base200} />)
    expect(screen.queryByText("content-type:")).not.toBeInTheDocument()
  })

  it("reveals headers when toggle is clicked", async () => {
    render(<ResponsePanel data={base200} />)
    await userEvent.click(screen.getByText(/Response headers/))
    expect(screen.getByText("content-type:")).toBeInTheDocument()
    expect(screen.getByText("text/plain")).toBeInTheDocument()
    expect(screen.getByText("x-request-id:")).toBeInTheDocument()
  })

  it("hides headers again on second click", async () => {
    render(<ResponsePanel data={base200} />)
    await userEvent.click(screen.getByText(/Response headers/))
    await userEvent.click(screen.getByText(/Response headers/))
    expect(screen.queryByText("content-type:")).not.toBeInTheDocument()
  })

  it("pretty-prints JSON body", () => {
    const data: ProxyResponse = {
      ...base200,
      resHeaders: { "content-type": "application/json" },
      resBody: '{"id":1}',
    }
    render(<ResponsePanel data={data} />)
    expect(screen.getByText(/\"id\": 1/)).toBeInTheDocument()
  })

  it("renders empty body placeholder when body is empty", () => {
    const data: ProxyResponse = { ...base200, resBody: "" }
    render(<ResponsePanel data={data} />)
    expect(screen.getByText("Empty response body")).toBeInTheDocument()
  })
})
