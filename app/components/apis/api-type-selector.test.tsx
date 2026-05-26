import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiTypeSelector } from "~/components/apis/api-type-selector";

describe("ApiTypeSelector", () => {
  it("renders both type buttons", () => {
    render(<ApiTypeSelector value="swagger2" onChange={vi.fn()} />);
    expect(screen.getByText("Swagger 2.0")).toBeInTheDocument();
    expect(screen.getByText("OpenAPI 3.0")).toBeInTheDocument();
  });

  it("marks selected value with primary styles", () => {
    render(<ApiTypeSelector value="swagger2" onChange={vi.fn()} />);
    const swagger = screen.getByText("Swagger 2.0");
    expect(swagger).toHaveClass("bg-primary");
    const openapi = screen.getByText("OpenAPI 3.0");
    expect(openapi).not.toHaveClass("bg-primary");
  });

  it("calls onChange with the new value when clicking", async () => {
    const onChange = vi.fn();
    render(<ApiTypeSelector value="swagger2" onChange={onChange} />);
    await userEvent.click(screen.getByText("OpenAPI 3.0"));
    expect(onChange).toHaveBeenCalledWith("openapi3");
  });

  it("includes a hidden input with the selected value", () => {
    render(<ApiTypeSelector value="openapi3" onChange={vi.fn()} />);
    const hidden = document.querySelector('input[name="type"]') as HTMLInputElement;
    expect(hidden?.value).toBe("openapi3");
  });
});
