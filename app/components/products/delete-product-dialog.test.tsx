import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { DeleteProductDialog } from "~/components/products/delete-product-dialog"

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

describe("DeleteProductDialog", () => {
  it("renders nothing when closed", () => {
    render(<DeleteProductDialog open={false} productName="Petstore" onOpenChange={vi.fn()} />)
    expect(screen.queryByText("Delete Product")).not.toBeInTheDocument()
  })

  it("shows title and product name when open", () => {
    render(<DeleteProductDialog open={true} productName="Petstore" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Delete Product")).toBeInTheDocument()
    expect(screen.getByText("Petstore")).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const onOpenChange = vi.fn()
    render(<DeleteProductDialog open={true} productName="Petstore" onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByText("Cancel"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("includes _intent=delete hidden input", () => {
    render(<DeleteProductDialog open={true} productName="Petstore" onOpenChange={vi.fn()} />)
    const input = document.querySelector('input[name="_intent"]') as HTMLInputElement
    expect(input?.value).toBe("delete")
  })

  it("shows Deleting… and disables Cancel while submitting", () => {
    mockFetcherState = "submitting"
    render(<DeleteProductDialog open={true} productName="Petstore" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Deleting…")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeDisabled()
  })

  it("shows deleteError when present", () => {
    mockFetcherData = { deleteError: "Something went wrong. Please try again." }
    render(<DeleteProductDialog open={true} productName="Petstore" onOpenChange={vi.fn()} />)
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
  })
})
