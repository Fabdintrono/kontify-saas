// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ToastProvider } from "./toast";
import { ActionButton } from "./action-button";
import type { ActionResult } from "@/lib/action-result";

afterEach(cleanup);

function setup(action: (fd: FormData) => Promise<ActionResult>) {
  render(
    <ToastProvider>
      <ActionButton action={action} payload={{ id: "abc", active: "true" }}
        successToast={{ title: "Cliente reactivado" }} pendingLabel="Reactivando…" className="btn">
        Reactivar
      </ActionButton>
    </ToastProvider>,
  );
  return action;
}

const click = (name = "Reactivar") => fireEvent.click(screen.getByRole("button", { name }));

describe("ActionButton", () => {
  it("llama a la acción con el payload como FormData y avisa del éxito", async () => {
    const action = setup(vi.fn(async () => {})) as ReturnType<typeof vi.fn>;
    click();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][0] as FormData;
    expect([...fd.entries()]).toEqual([["id", "abc"], ["active", "true"]]);
    await waitFor(() => expect(screen.getByText("Cliente reactivado")).toBeTruthy());
  });

  it("si la acción devuelve un error lo muestra y no avisa del éxito", async () => {
    setup(vi.fn(async () => ({ error: "Anula primero los cobros" })));
    click();
    await waitFor(() => expect(screen.getByText("No se pudo completar la acción")).toBeTruthy());
    expect(screen.getByText("Anula primero los cobros")).toBeTruthy();
    expect(screen.queryByText("Cliente reactivado")).toBeNull();
  });

  it("un redirect no es un error: no avisa nada", async () => {
    const action = vi.fn(async () => { throw Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;push;/x;307;" }); });
    setup(action);
    click();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("No se pudo completar la acción")).toBeNull();
    expect(screen.queryByText("Cliente reactivado")).toBeNull();
  });

  it("si la acción lanza avisa con un texto genérico", async () => {
    setup(vi.fn(async () => { throw new Error("Server Components render error"); }));
    click();
    await waitFor(() => expect(screen.getByText("No se pudo completar la acción")).toBeTruthy());
    expect(screen.getByText("Vuelve a intentarlo; si persiste, avisa a soporte.")).toBeTruthy();
  });

  it("mientras la acción corre muestra el pendingLabel y no admite otro clic", async () => {
    let resolve!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    setup(action);
    click();
    await waitFor(() => expect(screen.getByRole("button", { name: "Reactivando…" })).toBeTruthy());
    const btn = screen.getByRole("button", { name: "Reactivando…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: "Reactivar" })).toBeTruthy());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
