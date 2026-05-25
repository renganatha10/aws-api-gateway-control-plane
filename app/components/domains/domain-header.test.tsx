import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { DomainHeader } from "~/components/domains/domain-header"
import type { DomainItem } from "~/components/domains/types"

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; className?: string }) =>
    <a href={to} {...props}>{children}</a>,
}))

const domain: DomainItem = {
  domainName: "api.example.com",
  endpointType: "REGIONAL",
  awsDomainName: "d-abc.execute-api.us-east-1.amazonaws.com",
  certificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/abc",
  godaddyDomain: null,
  createdAt: new Date("2024-01-01"),
}

describe("DomainHeader", () => {
  it("renders the domain name as heading", () => {
    render(<DomainHeader domain={domain} onDeleteClick={vi.fn()} />)
    expect(screen.getByText("api.example.com")).toBeInTheDocument()
  })

  it("renders breadcrumb link to /domains", () => {
    render(<DomainHeader domain={domain} onDeleteClick={vi.fn()} />)
    expect(screen.getByRole("link", { name: "Domains" })).toHaveAttribute("href", "/domains")
  })

  it("renders Delete button", () => {
    render(<DomainHeader domain={domain} onDeleteClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  it("calls onDeleteClick when Delete is clicked", async () => {
    const onDeleteClick = vi.fn()
    render(<DomainHeader domain={domain} onDeleteClick={onDeleteClick} />)
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(onDeleteClick).toHaveBeenCalledOnce()
  })
})
