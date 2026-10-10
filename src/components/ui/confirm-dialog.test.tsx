// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ToastProvider } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

function setup(action: (fd: FormData) => Promise<void> = vi.fn(async () => {})) {
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

describe("ConfirmDialog", () => {
  it("abre al pulsar y cancela sin llamar a la acción", () => {
    const action = setup();
    fireEvent.click(screen.getByText("Anular"));
    expect(screen.getByText("¿Anular la venta #2?")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(action).not.toHaveBeenCalled();
  });

  it("confirma: llama a la acción con el payload como FormData y muestra el toast", async () => {
    const action = setup() as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByText("Anular"));
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("abc");
    await waitFor(() => expect(screen.getByText("Venta #2 anulada")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("¿Anular la venta #2?")).toBeNull());
  });

  it("si la acción falla avisa del error y deja el diálogo abierto", async () => {
    setup(vi.fn(async () => { throw new Error("Sin permiso"); }));
    fireEvent.click(screen.getByText("Anular"));
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(screen.getByText("No se pudo completar la acción")).toBeTruthy());
    expect(screen.getByText("Sin permiso")).toBeTruthy();
    expect(screen.getByText("¿Anular la venta #2?")).toBeTruthy();
    expect(screen.queryByText("Venta #2 anulada")).toBeNull();
  });
});
