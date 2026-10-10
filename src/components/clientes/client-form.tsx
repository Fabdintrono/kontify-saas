"use client";
import { useActionState, useState } from "react";
import { createClientTypeNamed, type FormState } from "@/app/(app)/clientes/actions";
import { FieldLabel } from "@/components/shared/field-label";
import { Button } from "@/components/ui/button";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type ClientType = { id: string; name: string };
type Values = {
  id?: string; kind?: "person" | "company"; name?: string; docId?: string; email?: string;
  phone?: string; address?: string; contactName?: string; typeId?: string | null; notes?: string;
};

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

export function ClientForm({ action, types, values = {}, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  types: ClientType[]; values?: Values; submitLabel: string;
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
    <form action={formAction} className="max-w-xl space-y-3">
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="typeId" value={typeId} />
      <div>
        <FieldLabel htmlFor="kind" help="tipoRegistro">Tipo de registro</FieldLabel>
        <select id="kind" name="kind" defaultValue={values.kind ?? "person"} className={inputCls}>
          <option value="person">Persona</option>
          <option value="company">Empresa</option>
        </select>
      </div>
      <div>
        <FieldLabel htmlFor="name">Nombre / Razón social *</FieldLabel>
        <input id="name" name="name" defaultValue={values.name ?? ""} className={inputCls} />
        {err("name") && <p className={`mt-1 text-xs ${DANGER_TEXT}`}>{err("name")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel htmlFor="docId" help="documentoId">Documento / ID</FieldLabel><input id="docId" name="docId" defaultValue={values.docId ?? ""} className={inputCls} /></div>
        <div><FieldLabel htmlFor="phone">Teléfono</FieldLabel><input id="phone" name="phone" defaultValue={values.phone ?? ""} className={inputCls} /></div>
      </div>
      <div>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <input id="email" name="email" type="email" defaultValue={values.email ?? ""} className={inputCls} />
        {err("email") && <p className={`mt-1 text-xs ${DANGER_TEXT}`}>{err("email")}</p>}
      </div>
      <div><FieldLabel htmlFor="address">Dirección</FieldLabel><input id="address" name="address" defaultValue={values.address ?? ""} className={inputCls} /></div>
      <div><FieldLabel htmlFor="contactName">Persona de contacto</FieldLabel><input id="contactName" name="contactName" defaultValue={values.contactName ?? ""} className={inputCls} /></div>
      <div>
        <FieldLabel htmlFor="typeId" help="tipoCliente">Tipo de cliente</FieldLabel>
        <div className="flex gap-2">
          <select id="typeId" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
            <option value="">Sin tipo</option>
            {localTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="flex-none rounded-[10px] border border-[var(--border)] px-3 text-sm text-[var(--text)]">+ Tipo</button>
        </div>
        {adding && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
            <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nuevo tipo (ej. VIP)" className={inputCls} />
            <Button variant="primary" type="button" onClick={addType} disabled={creating || !newType.trim()} className="flex-none">
              {creating ? "…" : "Crear"}
            </Button>
          </div>
        )}
        {typeErr && <p className={`mt-1 text-xs ${DANGER_TEXT}`}>{typeErr}</p>}
      </div>
      <div><FieldLabel htmlFor="notes">Notas</FieldLabel><textarea id="notes" name="notes" defaultValue={values.notes ?? ""} rows={3} className={inputCls} /></div>

      {state.error && <p className={`text-sm ${DANGER_TEXT}`}>{state.error}</p>}
      <Button variant="primary" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
