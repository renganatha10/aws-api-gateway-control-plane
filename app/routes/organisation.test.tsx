import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import OrganisationCreate from "~/routes/organisation"

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    Form: ({ children, ...props }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) =>
      <form {...props}>{children}</form>,
    useActionData: vi.fn(() => undefined),
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

describe("OrganisationCreate route", () => {
  it("renders the Create an Organisation heading", () => {
    render(<OrganisationCreate />)
    expect(screen.getByText("Create an Organisation")).toBeInTheDocument()
  })

  it("renders the organisation name input", () => {
    render(<OrganisationCreate />)
    expect(screen.getByLabelText(/Organisation name/i)).toBeInTheDocument()
  })

  it("renders a Create Organisation submit button", () => {
    render(<OrganisationCreate />)
    expect(screen.getByRole("button", { name: /Create Organisation/i })).toBeInTheDocument()
  })
})
