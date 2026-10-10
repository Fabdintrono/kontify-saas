import { describe, it, expect } from "vitest";
import { GENERIC_ERROR, actionError, isRedirectError } from "@/lib/action-result";

describe("actionError", () => {
  it("un Error nuestro se muestra tal cual", () => {
    expect(actionError(new Error("Solo se emiten borradores"))).toEqual({ error: "Solo se emiten borradores" });
  });

  // postgrest-js manda code: "" cuando falla el fetch o la respuesta no es JSON: sigue siendo inglés.
  it("un fallo de red de postgrest (code vacío) cae en el texto genérico", () => {
    expect(actionError({ message: "FetchError: fetch failed", code: "" })).toEqual({ error: GENERIC_ERROR });
  });

  it("un error de Postgres cae en el texto genérico", () => {
    expect(actionError({ message: "violates row-level security", code: "42501" })).toEqual({ error: GENERIC_ERROR });
  });

  it("sin mensaje también cae en el texto genérico", () => {
    expect(actionError(undefined)).toEqual({ error: GENERIC_ERROR });
    expect(actionError({})).toEqual({ error: GENERIC_ERROR });
  });
});

describe("isRedirectError", () => {
  it("reconoce el digest de redirect de Next", () => {
    expect(isRedirectError({ digest: "NEXT_REDIRECT;push;/x;307;" })).toBe(true);
  });
  it("un Error cualquiera no es un redirect", () => {
    expect(isRedirectError(new Error("x"))).toBe(false);
    expect(isRedirectError(null)).toBe(false);
  });
});
