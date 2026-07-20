import { z } from "zod";

export const CLIENT_KINDS = ["person", "company"] as const;

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optEmail =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email("Email inválido").max(120).optional());

const optTypeId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().uuid().nullable().optional());

export const clientCreateSchema = z.object({
  kind: z.enum(CLIENT_KINDS, { message: "Tipo inválido" }),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  docId: optStr(60),
  email: optEmail,
  phone: optStr(40),
  address: optStr(200),
  contactName: optStr(120),
  typeId: optTypeId,
  notes: optStr(1000),
});
export type ClientInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = clientCreateSchema; // el form de edición envía todos los campos

export const clientTypeCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
});
export type ClientTypeInput = z.infer<typeof clientTypeCreateSchema>;

export const clientTypeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});
