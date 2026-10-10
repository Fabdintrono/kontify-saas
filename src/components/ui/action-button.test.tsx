// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ToastProvider } from "./toast";
import { ActionButton } from "./action-button";

afterEach(cleanup);

function setup(action: (fd: FormData) => Promise<void>) {
  render(
    <ToastProvider>
      <ActionButton action={action} payload={{ id: "abc", active: "true" }}
        successToast={{ title: "Cliente reactivado" }} className="btn">
        Reactivar
      </ActionButton>
    </ToastProvider>,
  );
  return action;
}

describe("ActionButton", () => {
  it("llama a la acción con el payload como FormData y avisa del éxito", async () => {
    const action = setup(vi.fn(async () => {})) as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("abc");
    expect(fd.get("active")).toBe("true");
    await waitFor(() => expect(screen.getByText("Cliente reactivado")).toBeTruthy());
  });

  it("si la acción falla avisa del error y no del éxito", async () => {
    setup(vi.fn(async () => { throw new Error("Sin permiso"); }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(screen.getByText("No se pudo completar la acción")).toBeTruthy());
    expect(screen.getByText("Sin permiso")).toBeTruthy();
    expect(screen.queryByText("Cliente reactivado")).toBeNull();
  });
});
