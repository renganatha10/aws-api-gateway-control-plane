import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanFormDialog } from "~/components/plans/plan-form-dialog";
import { EMPTY_FORM } from "~/components/plans/types";
import type { Plan } from "~/lib/schema";

describe("PlanFormDialog", () => {
  const defaultProps = {
    open: true,
    editingPlan: null,
    form: { ...EMPTY_FORM },
    errors: {},
    submitting: false,
    onOpenChange: vi.fn(),
    onFormChange: vi.fn(),
    onSave: vi.fn(),
  };

  it("renders nothing when closed", () => {
    render(<PlanFormDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Create Plan")).not.toBeInTheDocument();
  });

  it("shows Create Plan title when no editing plan", () => {
    render(<PlanFormDialog {...defaultProps} />);
    expect(screen.getByText("Create Plan")).toBeInTheDocument();
  });

  it("shows Edit Plan title when editing a plan", () => {
    const plan: Plan = {
      id: 1,
      displayName: "Gold",
      name: "gold",
      organisationId: 1,
      throttle: null,
      burst: null,
      quotaLimit: null,
      quotaPeriod: null,
      createdBy: "admin",
      updatedBy: null,
      awsUsagePlanId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<PlanFormDialog {...defaultProps} editingPlan={plan} />);
    expect(screen.getByText("Edit Plan")).toBeInTheDocument();
  });

  it("renders name, throttle and burst inputs by label", () => {
    render(<PlanFormDialog {...defaultProps} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText(/Throttle/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Burst/)).toBeInTheDocument();
  });

  it("renders quota input by placeholder", () => {
    render(<PlanFormDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. 100000")).toBeInTheDocument();
  });

  it("calls onFormChange when name input changes", async () => {
    const onFormChange = vi.fn();
    render(<PlanFormDialog {...defaultProps} onFormChange={onFormChange} />);
    await userEvent.type(screen.getByPlaceholderText("e.g. gold"), "g");
    expect(onFormChange).toHaveBeenCalledWith({ name: "g" });
  });

  it("shows name error when provided", () => {
    render(<PlanFormDialog {...defaultProps} errors={{ name: "Name is required" }} />);
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("calls onSave when Create button is clicked", async () => {
    const onSave = vi.fn();
    render(<PlanFormDialog {...defaultProps} onSave={onSave} />);
    await userEvent.click(screen.getByText("Create"));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows 'Save changes' button when editing", () => {
    const plan: Plan = {
      id: 2,
      displayName: "Silver",
      name: "silver",
      organisationId: 1,
      throttle: 50,
      burst: 100,
      quotaLimit: null,
      quotaPeriod: null,
      createdBy: "admin",
      updatedBy: null,
      awsUsagePlanId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<PlanFormDialog {...defaultProps} editingPlan={plan} />);
    expect(screen.getByText("Save changes")).toBeInTheDocument();
  });

  it("disables save button while submitting", () => {
    render(<PlanFormDialog {...defaultProps} submitting={true} />);
    expect(screen.getByText("Create")).toBeDisabled();
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const onOpenChange = vi.fn();
    render(<PlanFormDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
