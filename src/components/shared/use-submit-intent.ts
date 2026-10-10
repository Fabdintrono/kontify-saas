"use client";
import { useEffect, useState } from "react";

/** Para formularios con varios botones de submit y un solo `pending` (useActionState):
 *  marca qué botón se pulsó y expone `isPending(intent)` para que solo ese cambie de texto.
 *  Si el submit no viene de un clic (p. ej. requestSubmit) no hay intención: ningún botón cambia de texto. */
export function useSubmitIntent<T extends string>(pending: boolean) {
  const [intent, setIntent] = useState<T | null>(null);
  useEffect(() => { if (!pending) setIntent(null); }, [pending]);
  return {
    mark: (i: T) => setIntent(i),
    isPending: (i: T) => pending && intent === i,
  };
}
