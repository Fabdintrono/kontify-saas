/** Resultado de una Server Action de un clic: nada si salió bien, o un error legible en español. */
export type ActionResult = void | { error: string };

/** Una acción que redirige rechaza la promesa en el cliente (server-action-reducer.js): la navegación
 *  ya está en marcha y el aviso lo da el ?flash= del destino. No es un error. */
export function isRedirectError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e
    && typeof (e as { digest: unknown }).digest === "string"
    && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}
