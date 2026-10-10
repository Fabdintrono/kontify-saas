// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ToastProvider } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";
import type { ActionResult } from "@/lib/action-result";

afterEach(cleanup);

function setup(action: (fd: FormData) => Promise<ActionResult> = vi.fn(async () => {})) {
  render(
    <ToastProvider>
      <ConfirmDialog action={action} payload={{ id: "abc" }} title="¿Anular la venta #2?"
        description="Repone el stock y no se puede deshacer." confirmLabel="Anular" tone="danger"
        successToast={{ title: "Venta #2 anulada" }} triggerClassName="btn">
        Anular
      </ConfirmDialog>
    </ToastProvider>,
  );
  return action;
}

// Con el diálogo abierto hay dos botones «Anular»: el disparador (detrás del overlay, aria-hidden)
// y el del modal. El último del DOM es siempre el del modal, que va en un portal al final del body.
const confirmBtn = () => screen.getAllByRole("button", { name: "Anular", hidden: true }).at(-1)!;
const open = () => fireEvent.click(screen.getByText("Anular"));

describe("ConfirmDialog", () => {
  it("abre al pulsar y cancela sin llamar a la acción", () => {
    const action = setup();
    open();
    expect(screen.getByText("¿Anular la venta #2?")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(action).not.toHaveBeenCalled();
  });

  it("confirma: llama a la acción con el payload como FormData y muestra el toast", async () => {
    const action = setup() as ReturnType<typeof vi.fn>;
    open();
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][0] as FormData;
    expect([...fd.entries()]).toEqual([["id", "abc"]]);
    await waitFor(() => expect(screen.getByText("Venta #2 anulada")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("¿Anular la venta #2?")).toBeNull());
  });

  it("si la acción devuelve un error lo muestra y deja el diálogo abierto", async () => {
    setup(vi.fn(async () => ({ error: "Anula primero los cobros" })));
    open();
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(screen.getByText("No se pudo completar la acción")).toBeTruthy());
    expect(screen.getByText("Anula primero los cobros")).toBeTruthy();
    expect(screen.getByText("¿Anular la venta #2?")).toBeTruthy();
    expect(screen.queryByText("Venta #2 anulada")).toBeNull();
  });

  // Una acción que redirige rechaza la promesa con un digest NEXT_REDIRECT: ya se está navegando
  // y el destino muestra su propio aviso, así que no debe salir ningún toast.
  it("un redirect no es un error: no avisa nada", async () => {
    const action = vi.fn(async () => { throw Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;push;/x;307;" }); });
    setup(action);
    open();
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("No se pudo completar la acción")).toBeNull();
    expect(screen.queryByText("Venta #2 anulada")).toBeNull();
  });

  it("si la acción lanza avisa con un texto genérico (en producción el mensaje del servidor no llega)", async () => {
    setup(vi.fn(async () => { throw new Error("Server Components render error"); }));
    open();
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(screen.getByText("No se pudo completar la acción")).toBeTruthy());
    expect(screen.getByText("Vuelve a intentarlo; si persiste, avisa a soporte.")).toBeTruthy();
    expect(screen.getByText("¿Anular la venta #2?")).toBeTruthy();
  });
});
