import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { ConsumerCredentials } from "~/components/consumers/consumer-credentials"

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useFetcher: () => ({
      data: undefined,
      state: "idle",
      load: vi.fn(),
      Form: ({ children, ...props }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) =>
        <form {...props}>{children}</form>,
      submit: vi.fn(),
    }),
  }
})

const baseConsumer = {
  id: 42,
  clientId: "client-abc-123",
  tokenUrl: "https://auth.example.com/token",
  createdBy: "admin@example.com",
  createdAt: new Date("2024-03-01T10:00:00Z"),
  updatedBy: null,
  updatedAt: new Date("2024-03-01T10:00:00Z"),
}

describe("ConsumerCredentials", () => {
  it("shows Client ID when provided", () => {
    render(<ConsumerCredentials consumer={baseConsumer} />)
    expect(screen.getByTestId("client-id")).toHaveTextContent("client-abc-123")
  })

  it("shows Token URL when provided", () => {
    render(<ConsumerCredentials consumer={baseConsumer} />)
    expect(screen.getByTestId("token-url")).toHaveTextContent("https://auth.example.com/token")
  })

  it("shows createdBy information", () => {
    render(<ConsumerCredentials consumer={baseConsumer} />)
    expect(screen.getByText("admin@example.com")).toBeInTheDocument()
  })

  it("does not show Client ID section when clientId is null", () => {
    render(<ConsumerCredentials consumer={{ ...baseConsumer, clientId: null }} />)
    expect(screen.queryByTestId("client-id")).not.toBeInTheDocument()
  })

  it("does not show Token URL section when tokenUrl is null", () => {
    render(<ConsumerCredentials consumer={{ ...baseConsumer, tokenUrl: null }} />)
    expect(screen.queryByTestId("token-url")).not.toBeInTheDocument()
  })

  it("shows updatedBy section when provided", () => {
    render(<ConsumerCredentials consumer={{ ...baseConsumer, updatedBy: "editor@example.com" }} />)
    expect(screen.getByText("editor@example.com")).toBeInTheDocument()
    expect(screen.getByText("Last updated by")).toBeInTheDocument()
  })

  it("does not show Last updated by section when updatedBy is null", () => {
    render(<ConsumerCredentials consumer={baseConsumer} />)
    expect(screen.queryByText("Last updated by")).not.toBeInTheDocument()
  })
})
