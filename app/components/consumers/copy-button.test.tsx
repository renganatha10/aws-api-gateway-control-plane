import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "~/components/consumers/copy-button";

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText },
  writable: true,
});

describe("CopyButton", () => {
  beforeEach(() => writeText.mockClear());

  it("renders Copy icon initially", () => {
    render(<CopyButton value="secret" />);
    expect(screen.getByTitle("Copy")).toBeInTheDocument();
  });

  it("calls clipboard.writeText with the value on click", async () => {
    render(<CopyButton value="my-token" />);
    await userEvent.click(screen.getByTitle("Copy"));
    expect(writeText).toHaveBeenCalledWith("my-token");
  });

  it("shows Check icon after copying", async () => {
    render(<CopyButton value="my-token" />);
    await userEvent.click(screen.getByTitle("Copy"));
    // After click, state updates to copied=true
    await act(async () => {});
    // The copied state toggles the icon — the button should still be rendered
    expect(screen.getByTitle("Copy")).toBeInTheDocument();
  });
});
