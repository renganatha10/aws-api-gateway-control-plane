import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { DeleteConsumerDialog } from "~/components/consumers/delete-consumer-dialog"

let mockFetcherState = "idle"
let mockFetcherData: Record<string, string> | undefined = undefined

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useFetcher: () => ({
      data: mockFetcherData,
      state: mockFetcherState,
      Form: ({ children, ...props }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) =>
        <form {...props}>{children}</form>,
      submit: vi.fn(),
      load: vi.fn(),
    }),
  }
})

beforeEach(() => {
  mockFetcherState = "idle"
  mockFetcherData = undefined
})

describe("DeleteConsumerDialog", () => {
  it("renders nothing when closed", () => {
    render(<DeleteConsumerDialog open={false} consumerName="mobile-app" onOpenChange={vi.fn()} />)
    expect(screen.queryByText("Delete Consumer")).not.toBeInTheDocument()
  })

  it("shows title and consumer name when open", () => {
    render(<DeleteConsumerDialog open={true} consumerName="mobile-app" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Delete Consumer")).toBeInTheDocument()
    expect(screen.getByText("mobile-app")).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const onOpenChange = vi.fn()
    render(<DeleteConsumerDialog open={true} consumerName="mobile-app" onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByText("Cancel"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("includes _intent=delete hidden input", () => {
    render(<DeleteConsumerDialog open={true} consumerName="mobile-app" onOpenChange={vi.fn()} />)
    const input = document.querySelector('input[name="_intent"]') as HTMLInputElement
    expect(input?.value).toBe("delete")
  })

  it("shows Deleting… and disables Cancel while submitting", () => {
    mockFetcherState = "submitting"
    render(<DeleteConsumerDialog open={true} consumerName="mobile-app" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Deleting…")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeDisabled()
  })

  it("displays deleteError when present", () => {
    mockFetcherData = { deleteError: "Something went wrong. Please try again." }
    render(<DeleteConsumerDialog open={true} consumerName="mobile-app" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
  })
})
