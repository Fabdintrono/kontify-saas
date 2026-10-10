// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useSubmitIntent } from "./use-submit-intent";

afterEach(cleanup);

describe("useSubmitIntent", () => {
  it("solo el botón pulsado se ve como pendiente", () => {
    const { result, rerender } = renderHook(({ pending }) => useSubmitIntent<"save" | "emit">(pending), { initialProps: { pending: false } });
    act(() => result.current.mark("emit"));
    rerender({ pending: true });
    expect(result.current.isPending("emit")).toBe(true);
    expect(result.current.isPending("save")).toBe(false);
  });
  it("se limpia cuando termina la acción", () => {
    const { result, rerender } = renderHook(({ pending }) => useSubmitIntent<"save" | "emit">(pending), { initialProps: { pending: false } });
    act(() => result.current.mark("save"));
    rerender({ pending: true });
    rerender({ pending: false });
    expect(result.current.isPending("save")).toBe(false);
  });
});
