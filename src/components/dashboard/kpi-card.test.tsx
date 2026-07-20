// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { KpiCard } from "./kpi-card";

describe("KpiCard", () => {
  it("muestra el valor cuando hay datos", () => {
    render(<KpiCard icon={Wallet} label="Ventas del mes" value="$1.200" />);
    expect(screen.getByText("$1.200")).toBeTruthy();
    expect(screen.getByText("Ventas del mes")).toBeTruthy();
  });
  it("muestra empty state cuando no hay valor", () => {
    render(<KpiCard icon={Wallet} label="Ventas del mes" />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Sin datos aún")).toBeTruthy();
  });
});
