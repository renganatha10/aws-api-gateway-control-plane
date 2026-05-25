import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { PlanCard } from "~/components/plans/plan-card"
import type { Plan } from "~/lib/schema"

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useFetcher: () => ({
      data: undefined,
      state: "idle",
      Form: ({ children, ...props }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) =>
        <form {...props}>{children}</form>,
      submit: vi.fn(),
      load: vi.fn(),
    }),
  }
})

const basePlan: Plan = {
  id: 1,
  displayName: "Gold Plan",
  name: "gold-plan",
  organisationId: 10,
  throttle: 100,
  burst: 200,
  quotaLimit: 10000,
  quotaPeriod: "month",
  createdBy: "admin@example.com",
  updatedBy: null,
  awsUsagePlanId: "plan-abc",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
}

describe("PlanCard", () => {
  it("renders the plan name", () => {
    render(<PlanCard plan={basePlan} onEdit={vi.fn()} />)
    expect(screen.getByText("gold-plan")).toBeInTheDocument()
  })

  it("shows throttle value", () => {
    render(<PlanCard plan={basePlan} onEdit={vi.fn()} />)
    expect(screen.getByText("100/sec")).toBeInTheDocument()
  })

  it("shows burst value", () => {
    render(<PlanCard plan={basePlan} onEdit={vi.fn()} />)
    expect(screen.getByText("200/sec")).toBeInTheDocument()
  })

  it("shows quota value", () => {
    render(<PlanCard plan={basePlan} onEdit={vi.fn()} />)
    expect(screen.getByText("10,000/month")).toBeInTheDocument()
  })

  it("shows 'No limits configured' when all limits are null", () => {
    const plan = { ...basePlan, throttle: null, burst: null, quotaLimit: null }
    render(<PlanCard plan={plan} onEdit={vi.fn()} />)
    expect(screen.getByText("No limits configured")).toBeInTheDocument()
  })

  it("calls onEdit with the plan when edit button is clicked", async () => {
    const onEdit = vi.fn()
    render(<PlanCard plan={basePlan} onEdit={onEdit} />)
    await userEvent.click(screen.getByLabelText("Edit plan"))
    expect(onEdit).toHaveBeenCalledWith(basePlan)
  })

  it("opens delete dialog when delete button is clicked", async () => {
    render(<PlanCard plan={basePlan} onEdit={vi.fn()} />)
    await userEvent.click(screen.getByLabelText("Delete plan"))
    expect(screen.getByText("Delete Plan")).toBeInTheDocument()
  })
})
