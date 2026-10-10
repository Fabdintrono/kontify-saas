// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "./data-table";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams("q=ana&page=7&sort=name&dir=asc"),
}));

afterEach(() => { cleanup(); push.mockClear(); });

type Row = { id: string; name: string; total: number };
const rows: Row[] = [{ id: "1", name: "Ana", total: 10 }, { id: "2", name: "Beto", total: 20 }];
const columns: Column<Row>[] = [
  { key: "name", label: "Nombre", width: "60%", sortable: true, natural: "asc", cell: (r) => r.name },
  { key: "total", label: "Total", width: "40%", align: "right", sortable: true, natural: "desc", cell: (r) => r.total },
];

function renderTable(extra?: Partial<Parameters<typeof DataTable<Row>>[0]>) {
  return render(
    <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} sort={{ key: "name", dir: "asc" }} {...extra} />,
  );
}

describe("DataTable", () => {
  it("emite un <col> por columna con el ancho declarado", () => {
    const { container } = renderTable();
    const cols = container.querySelectorAll("colgroup col");
    expect(cols.length).toBe(2);
    expect((cols[0] as HTMLElement).style.width).toBe("60%");
    expect((cols[1] as HTMLElement).style.width).toBe("40%");
  });

  it("la tabla ocupa el ancho completo de su caja", () => {
    const { container } = renderTable();
    expect(container.querySelector("table")!.className).toContain("w-full");
  });

  it("marca con aria-sort la columna activa y deja las demás en none", () => {
    renderTable();
    const [nombre, total] = screen.getAllByRole("columnheader");
    expect(nombre.getAttribute("aria-sort")).toBe("ascending");
    expect(total.getAttribute("aria-sort")).toBe("none");
  });

  it("una columna sin sortable no trae botón ni aria-sort", () => {
    render(
      <DataTable rows={rows} rowKey={(r) => r.id}
        columns={[{ key: "name", label: "Nombre", width: "100%", cell: (r) => r.name }]} />,
    );
    expect(screen.getAllByRole("columnheader")[0].hasAttribute("aria-sort")).toBe(false);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("las columnas de cifras van a la derecha con cifras de ancho fijo", () => {
    const { container } = renderTable();
    const celda = container.querySelectorAll("tbody tr td")[1] as HTMLElement;
    expect(celda.className).toContain("text-right");
    expect(celda.className).toContain("tabular-nums");
  });

  it("pulsar la columna activa invierte la dirección y borra la página", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /Nombre/ }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("sort")).toBe("name");
    expect(url.searchParams.get("dir")).toBe("desc");
    expect(url.searchParams.get("page")).toBeNull();
    expect(url.searchParams.get("q")).toBe("ana"); // el filtro en curso se conserva
  });

  it("pulsar otra columna la estrena con su dirección natural", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /Total/ }));
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("sort")).toBe("total");
    expect(url.searchParams.get("dir")).toBe("desc");
  });
});
