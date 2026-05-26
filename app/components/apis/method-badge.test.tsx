import { render, screen } from "@testing-library/react";
import { MethodBadge } from "~/components/apis/method-badge";

describe("MethodBadge (apis)", () => {
  it("renders the method in uppercase", () => {
    render(<MethodBadge method="get" />);
    expect(screen.getByText("GET")).toBeInTheDocument();
  });

  it("applies blue background for GET", () => {
    render(<MethodBadge method="get" />);
    expect(screen.getByText("GET")).toHaveClass("bg-blue-600");
  });

  it("applies green background for POST", () => {
    render(<MethodBadge method="post" />);
    expect(screen.getByText("POST")).toHaveClass("bg-green-600");
  });

  it("applies amber background for PUT", () => {
    render(<MethodBadge method="put" />);
    expect(screen.getByText("PUT")).toHaveClass("bg-amber-500");
  });

  it("applies red background for DELETE", () => {
    render(<MethodBadge method="delete" />);
    expect(screen.getByText("DELETE")).toHaveClass("bg-red-600");
  });

  it("applies purple background for PATCH", () => {
    render(<MethodBadge method="patch" />);
    expect(screen.getByText("PATCH")).toHaveClass("bg-purple-600");
  });

  it("applies fallback background for unknown method", () => {
    render(<MethodBadge method="trace" />);
    expect(screen.getByText("TRACE")).toHaveClass("bg-zinc-600");
  });
});
