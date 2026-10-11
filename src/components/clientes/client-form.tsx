"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createClientTypeNamed, type FormState } from "@/app/(app)/clientes/actions";
import { FieldLabel } from "@/components/shared/field-label";
import { FormLayout, FormSection, FormGrid, FormWide, FormActions, FormAside } from "@/components/shared/form-shell";
import { Button } from "@/components/ui/button";
import { Field, fieldCls } from "@/components/ui/field";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type ClientType = { id: string; name: string };
type Values = {
  id?: string; kind?: "person" | "company"; name?: string; docId?: string; email?: string;
  phone?: string; address?: string; contactName?: string; typeId?: string | null; notes?: string;
};

const initial: FormState = { ok: false };

const AYUDA = [
  "Con el nombre basta para guardar. Todo lo demás lo puedes completar después.",
  "El documento y el teléfono sirven para encontrar al cliente al vender, sin recordar el nombre exacto.",
  "El tipo agrupa clientes para filtrar y para el desglose del inicio. Puedes crear uno aquí mismo.",
  "Guardar no envía nada al cliente: el registro es solo tuyo.",
];

export function ClientForm({ action, types, values = {}, submitLabel, cancelHref }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  types: ClientType[]; values?: Values; submitLabel: string; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [localTypes, setLocalTypes] = useState<ClientType[]>(types);
  const [typeId, setTypeId] = useState<string>(values.typeId ?? "");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");
  const [typeErr, setTypeErr] = useState("");
  const [creating, setCreating] = useState(false);
  const err = (k: string) => state.fieldErrors?.[k];

  async function addType() {
    setCreating(true); setTypeErr("");
    const r = await createClientTypeNamed(newType);   // server action llamada directamente
    setCreating(false);
    if (!r.ok || !r.type) { setTypeErr(r.error ?? "No se pudo crear"); return; }
    setLocalTypes((prev) => [...prev, r.type!].sort((a, b) => a.name.localeCompare(b.name)));
    setTypeId(r.type.id); setNewType(""); setAdding(false);
  }

  return (
    <form action={formAction}>
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="typeId" value={typeId} />

      <FormLayout aside={<FormAside title="Qué hace esta pantalla" items={AYUDA} />}>
        <FormSection title="Identificación" hint="Lo mínimo para registrar al cliente.">
          <FormGrid cols={2}>
            <div>
              <FieldLabel htmlFor="kind" help="tipoRegistro">Tipo de registro</FieldLabel>
              <select id="kind" name="kind" defaultValue={values.kind ?? "person"} className={fieldCls()}>
                <option value="person">Persona</option>
                <option value="company">Empresa</option>
              </select>
            </div>
            <Field id="name" error={err("name")}
              label={<FieldLabel htmlFor="name">Nombre o razón social *</FieldLabel>}>
              {(p) => <input {...p} name="name" defaultValue={values.name ?? ""} autoFocus
                placeholder="Ej. Farmacia Central C.A." className={fieldCls(!!err("name"))} />}
            </Field>
            <div>
              <FieldLabel htmlFor="docId" help="documentoId">Documento o identificación</FieldLabel>
              <input id="docId" name="docId" defaultValue={values.docId ?? ""}
                placeholder="Ej. J-12345678-9" className={fieldCls()} />
            </div>
            <FormWide>
              <FieldLabel htmlFor="typeId" help="tipoCliente">Tipo de cliente</FieldLabel>
              <div className="flex gap-2">
                <select id="typeId" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={fieldCls(false, "max-w-sm")}>
                  <option value="">Sin tipo</option>
                  {localTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding}
                  className="inline-flex h-[42px] flex-none items-center gap-1 rounded-[10px] border border-[var(--border)] px-3 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]">
                  <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Tipo
                </button>
              </div>
              {adding && (
                <div className="mt-2 flex animate-fade-up items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
                  <label htmlFor="nuevo-tipo-cliente" className="sr-only">Nombre del nuevo tipo</label>
                  <input id="nuevo-tipo-cliente" value={newType} onChange={(e) => setNewType(e.target.value)}
                    placeholder="Ej. VIP" className={fieldCls()} />
                  <Button variant="primary" type="button" onClick={addType}
                    disabled={!newType.trim()} loading={creating} className="flex-none">Crear</Button>
                </div>
              )}
              {typeErr && <p className={`mt-1 text-xs ${DANGER_TEXT}`}>{typeErr}</p>}
            </FormWide>
          </FormGrid>
        </FormSection>

        <FormSection title="Contacto" hint="Para ubicarlo cuando haya que cobrar o despachar.">
          <FormGrid cols={2}>
            <div>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={values.phone ?? ""}
                placeholder="Ej. 0412-1234567" className={fieldCls()} />
            </div>
            <Field id="email" error={err("email")} label={<FieldLabel htmlFor="email">Correo</FieldLabel>}>
              {(p) => <input {...p} name="email" type="email" autoComplete="email" defaultValue={values.email ?? ""}
                placeholder="Ej. compras@empresa.com" className={fieldCls(!!err("email"))} />}
            </Field>
            <div>
              <FieldLabel htmlFor="contactName">Persona de contacto</FieldLabel>
              <input id="contactName" name="contactName" defaultValue={values.contactName ?? ""}
                placeholder="Ej. María González" className={fieldCls()} />
            </div>
            <div>
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <input id="address" name="address" defaultValue={values.address ?? ""}
                placeholder="Ej. Av. Principal, local 3" className={fieldCls()} />
            </div>
          </FormGrid>
        </FormSection>

        <FormSection title="Notas" hint="Lo que quieras recordar de este cliente. Solo lo ves tú y tu equipo.">
          <FormGrid cols={1}>
            <FormWide>
              <label htmlFor="notes" className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Notas internas</label>
              <textarea id="notes" name="notes" defaultValue={values.notes ?? ""} rows={3}
                placeholder="Ej. paga a 15 días, despachar los martes" className={fieldCls()} />
            </FormWide>
          </FormGrid>
        </FormSection>

        {state.error && (
          <p role="alert" className={`rounded-xl border border-[#b91c1c]/30 bg-[#b91c1c]/5 p-3 text-sm ${DANGER_TEXT}`}>
            {state.error}
          </p>
        )}
      </FormLayout>

      <FormActions cancelHref={cancelHref}>
        <Button variant="primary" loading={pending}>{pending ? "Guardando" : submitLabel}</Button>
      </FormActions>
    </form>
  );
}
