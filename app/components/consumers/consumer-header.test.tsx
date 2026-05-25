import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { ConsumerHeader } from "~/components/consumers/consumer-header"

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; className?: string }) =>
    <a href={to} {...props}>{children}</a>,
}))

describe("ConsumerHeader", () => {
  const defaults = {
    consumerName: "mobile-app",
    submitting: false,
    saved: false,
    error: null,
    onDeleteClick: vi.fn(),
  }

  it("renders the consumer name", () => {
    render(<ConsumerHeader {...defaults} />)
    expect(screen.getByText("mobile-app")).toBeInTheDocument()
  })

  it("renders a breadcrumb link to /consumers", () => {
    render(<ConsumerHeader {...defaults} />)
    expect(screen.getByRole("link", { name: "Consumers" })).toHaveAttribute("href", "/consumers")
  })

  it("shows Save button", () => {
    render(<ConsumerHeader {...defaults} />)
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
  })

  it("shows Saving… and disables Save while submitting", () => {
    render(<ConsumerHeader {...defaults} submitting={true} />)
    expect(screen.getByText("Saving…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  })

  it("shows Saved indicator when saved=true", () => {
    render(<ConsumerHeader {...defaults} saved={true} />)
    expect(screen.getByText("Saved")).toBeInTheDocument()
  })

  it("does not show Saved indicator when saved=false", () => {
    render(<ConsumerHeader {...defaults} saved={false} />)
    expect(screen.queryByText("Saved")).not.toBeInTheDocument()
  })

  it("shows error message when provided", () => {
    render(<ConsumerHeader {...defaults} error="Something went wrong." />)
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument()
  })

  it("calls onDeleteClick when Delete button is clicked", async () => {
    const onDeleteClick = vi.fn()
    render(<ConsumerHeader {...defaults} onDeleteClick={onDeleteClick} />)
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }))
    expect(onDeleteClick).toHaveBeenCalledOnce()
  })
})
