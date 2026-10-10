/** Resultado de una Server Action de un clic: nada si salió bien, o un error legible en español. */
export type ActionResult = void | { error: string };

/** Una acción que redirige rechaza la promesa en el cliente (server-action-reducer.js): la navegación
 *  ya está en marcha y el aviso lo da el ?flash= del destino. No es un error. */
export function isRedirectError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e
    && typeof (e as { digest: unknown }).digest === "string"
    && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

/** Lo que se le dice al usuario cuando no tenemos un motivo concreto que mostrarle. */
export const GENERIC_ERROR = "Vuelve a intentarlo; si persiste, avisa a soporte.";

/** Solo se muestran los mensajes que escribimos nosotros. Los de Postgres/Supabase traen `code`
 *  y vienen en inglés con nombres de tablas: esos se cambian por el texto genérico. */
export function actionError(e: unknown): { error: string } {
  const err = e as { message?: string; code?: string };
  return { error: !err?.code && err?.message ? err.message : GENERIC_ERROR };
}
