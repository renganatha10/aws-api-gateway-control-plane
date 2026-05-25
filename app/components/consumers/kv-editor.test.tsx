import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { KVEditor } from "~/components/consumers/kv-editor"
import type { KVRow } from "~/components/consumers/tryout-types"

describe("KVEditor", () => {
  it("renders existing rows", () => {
    const rows: KVRow[] = [{ key: "Authorization", value: "Bearer token" }]
    render(<KVEditor rows={rows} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("Authorization")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Bearer token")).toBeInTheDocument()
  })

  it("renders Add row button", () => {
    render(<KVEditor rows={[]} onChange={vi.fn()} />)
    expect(screen.getByText("Add row")).toBeInTheDocument()
  })

  it("calls onChange with new empty row when Add row is clicked", async () => {
    const onChange = vi.fn()
    render(<KVEditor rows={[]} onChange={onChange} />)
    await userEvent.click(screen.getByText("Add row"))
    expect(onChange).toHaveBeenCalledWith([{ key: "", value: "" }])
  })

  it("calls onChange with updated key when key input changes", () => {
    const onChange = vi.fn()
    const rows: KVRow[] = [{ key: "", value: "" }]
    render(<KVEditor rows={rows} onChange={onChange} />)
    const [keyInput] = screen.getAllByRole("textbox")
    fireEvent.change(keyInput, { target: { value: "X-Custom-Header" } })
    expect(onChange).toHaveBeenCalledWith([{ key: "X-Custom-Header", value: "" }])
  })

  it("calls onChange with updated value when value input changes", () => {
    const onChange = vi.fn()
    const rows: KVRow[] = [{ key: "key1", value: "" }]
    render(<KVEditor rows={rows} onChange={onChange} />)
    const inputs = screen.getAllByRole("textbox")
    fireEvent.change(inputs[1], { target: { value: "my-value" } })
    expect(onChange).toHaveBeenCalledWith([{ key: "key1", value: "my-value" }])
  })

  it("calls onChange with row removed when delete button is clicked", async () => {
    const onChange = vi.fn()
    const rows: KVRow[] = [{ key: "a", value: "1" }, { key: "b", value: "2" }]
    render(<KVEditor rows={rows} onChange={onChange} />)
    // There are 2 delete buttons + 1 "Add row" button; click the first delete
    const buttons = screen.getAllByRole("button")
    await userEvent.click(buttons[0])
    expect(onChange).toHaveBeenCalledWith([{ key: "b", value: "2" }])
  })

  it("uses custom key placeholder", () => {
    render(<KVEditor rows={[{ key: "", value: "" }]} onChange={vi.fn()} keyPlaceholder="Header" valuePlaceholder="Value" />)
    expect(screen.getByPlaceholderText("Header")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Value")).toBeInTheDocument()
  })

  it("renders multiple rows", () => {
    const rows: KVRow[] = [{ key: "A", value: "1" }, { key: "B", value: "2" }]
    render(<KVEditor rows={rows} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("A")).toBeInTheDocument()
    expect(screen.getByDisplayValue("B")).toBeInTheDocument()
  })
})
