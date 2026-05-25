import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { DeletePlanDialog } from "~/components/plans/delete-plan-dialog"
import type { Plan } from "~/lib/schema"

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

const plan: Plan = {
  id: 3,
  displayName: "Silver Plan",
  name: "silver-plan",
  organisationId: 10,
  throttle: 50,
  burst: 100,
  quotaLimit: null,
  quotaPeriod: null,
  createdBy: "admin@example.com",
  updatedBy: null,
  awsUsagePlanId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
}

describe("DeletePlanDialog", () => {
  it("renders nothing when closed", () => {
    render(<DeletePlanDialog plan={plan} open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText("Delete Plan")).not.toBeInTheDocument()
  })

  it("shows title and plan name when open", () => {
    render(<DeletePlanDialog plan={plan} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText("Delete Plan")).toBeInTheDocument()
    expect(screen.getByText("silver-plan")).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const onOpenChange = vi.fn()
    render(<DeletePlanDialog plan={plan} open={true} onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByText("Cancel"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("includes _intent=delete and plan id in hidden inputs", () => {
    render(<DeletePlanDialog plan={plan} open={true} onOpenChange={vi.fn()} />)
    const intentInput = document.querySelector('input[name="_intent"]') as HTMLInputElement
    const idInput = document.querySelector('input[name="id"]') as HTMLInputElement
    expect(intentInput?.value).toBe("delete")
    expect(idInput?.value).toBe("3")
  })

  it("shows Deleting… while submitting", () => {
    mockFetcherState = "submitting"
    render(<DeletePlanDialog plan={plan} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText("Deleting…")).toBeInTheDocument()
  })

  it("shows error when present", () => {
    mockFetcherData = { error: "Something went wrong. Please try again." }
    render(<DeletePlanDialog plan={plan} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
  })
})
