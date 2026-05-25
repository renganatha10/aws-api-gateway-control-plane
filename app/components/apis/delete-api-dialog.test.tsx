import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { DeleteApiDialog } from "~/components/apis/delete-api-dialog"

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

describe("DeleteApiDialog", () => {
  it("renders nothing when closed", () => {
    render(<DeleteApiDialog open={false} apiDisplayName="My API" onOpenChange={vi.fn()} />)
    expect(screen.queryByText("Delete API")).not.toBeInTheDocument()
  })

  it("shows title and API name when open", () => {
    render(<DeleteApiDialog open={true} apiDisplayName="My API" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Delete API")).toBeInTheDocument()
    expect(screen.getByText("My API")).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const onOpenChange = vi.fn()
    render(<DeleteApiDialog open={true} apiDisplayName="My API" onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByText("Cancel"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows Delete button with delete intent hidden input", () => {
    render(<DeleteApiDialog open={true} apiDisplayName="My API" onOpenChange={vi.fn()} />)
    const input = document.querySelector('input[name="_intent"]') as HTMLInputElement
    expect(input?.value).toBe("delete")
  })

  it("shows Deleting… and disables Cancel when submitting", () => {
    mockFetcherState = "submitting"
    render(<DeleteApiDialog open={true} apiDisplayName="My API" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Deleting…")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeDisabled()
  })

  it("displays deleteError when present", () => {
    mockFetcherData = { deleteError: "Something went wrong. Please try again." }
    render(<DeleteApiDialog open={true} apiDisplayName="My API" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
  })
})
