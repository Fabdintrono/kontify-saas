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

/** Solo se muestran los mensajes que escribimos nosotros. Los de Postgres/Supabase vienen en inglés
 *  y con nombres de tablas: esos se cambian por el texto genérico. Se detectan por la PRESENCIA de
 *  `code`, no por su valor: postgrest-js manda `code: ""` cuando falla el fetch o la respuesta no es
 *  JSON, y mirar la verdad del valor dejaría pasar ese inglés. */
export function actionError(e: unknown): { error: string } {
  const fromDb = typeof e === "object" && e !== null && "code" in e;
  const msg = (e as { message?: string })?.message;
  return { error: !fromDb && msg ? msg : GENERIC_ERROR };
}
