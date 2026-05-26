import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RevealSecret } from "~/components/consumers/reveal-secret";

let mockFetcherState = "idle";
let mockFetcherData: { secret?: string; error?: string } | undefined;
const mockLoad = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useFetcher: () => ({
      data: mockFetcherData,
      state: mockFetcherState,
      load: mockLoad,
      Form: ({
        children,
        ...props
      }: React.PropsWithChildren<React.FormHTMLAttributes<HTMLFormElement>>) => (
        <form {...props}>{children}</form>
      ),
      submit: vi.fn(),
    }),
  };
});

beforeEach(() => {
  mockFetcherState = "idle";
  mockFetcherData = undefined;
  mockLoad.mockClear();
});

describe("RevealSecret", () => {
  it("renders Show secret button initially", () => {
    render(<RevealSecret consumerId={1} />);
    expect(screen.getByText("Show secret")).toBeInTheDocument();
  });

  it("calls fetcher.load with the correct URL when Show secret is clicked", async () => {
    render(<RevealSecret consumerId={7} />);
    await userEvent.click(screen.getByText("Show secret"));
    expect(mockLoad).toHaveBeenCalledWith("/api/consumer-secret/7");
  });

  it("shows Loading… and disables button while loading", () => {
    mockFetcherState = "loading";
    render(<RevealSecret consumerId={1} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows masked secret after fetch resolves", () => {
    mockFetcherData = { secret: "super-secret-value" };
    render(<RevealSecret consumerId={1} />);
    expect(screen.getByText("••••••••••••••••")).toBeInTheDocument();
  });

  it("reveals secret when eye button is clicked", async () => {
    mockFetcherData = { secret: "super-secret-value" };
    render(<RevealSecret consumerId={1} />);
    await userEvent.click(screen.getByTitle("Show"));
    expect(screen.getByText("super-secret-value")).toBeInTheDocument();
  });

  it("hides secret again when eye button is clicked a second time", async () => {
    mockFetcherData = { secret: "super-secret-value" };
    render(<RevealSecret consumerId={1} />);
    await userEvent.click(screen.getByTitle("Show"));
    await userEvent.click(screen.getByTitle("Hide"));
    expect(screen.getByText("••••••••••••••••")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", () => {
    mockFetcherData = { error: "Something went wrong. Please try again." };
    render(<RevealSecret consumerId={1} />);
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});
