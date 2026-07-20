"use client";
import { useActionState, useState } from "react";
import { createClientTypeNamed, type FormState } from "@/app/(app)/clientes/actions";

type ClientType = { id: string; name: string };
type Values = {
  id?: string; kind?: "person" | "company"; name?: string; docId?: string; email?: string;
  phone?: string; address?: string; contactName?: string; typeId?: string | null; notes?: string;
};

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

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
        <label className={labelCls}>Tipo de registro</label>
        <select name="kind" defaultValue={values.kind ?? "person"} className={inputCls}>
          <option value="person">Persona</option>
          <option value="company">Empresa</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Nombre / Razón social *</label>
        <input name="name" defaultValue={values.name ?? ""} className={inputCls} />
        {err("name") && <p className="mt-1 text-xs text-[#dc2626]">{err("name")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Documento / ID</label><input name="docId" defaultValue={values.docId ?? ""} className={inputCls} /></div>
        <div><label className={labelCls}>Teléfono</label><input name="phone" defaultValue={values.phone ?? ""} className={inputCls} /></div>
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input name="email" type="email" defaultValue={values.email ?? ""} className={inputCls} />
        {err("email") && <p className="mt-1 text-xs text-[#dc2626]">{err("email")}</p>}
      </div>
      <div><label className={labelCls}>Dirección</label><input name="address" defaultValue={values.address ?? ""} className={inputCls} /></div>
      <div><label className={labelCls}>Persona de contacto</label><input name="contactName" defaultValue={values.contactName ?? ""} className={inputCls} /></div>
      <div>
        <label className={labelCls}>Tipo de cliente</label>
        <div className="flex gap-2">
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
            <option value="">Sin tipo</option>
            {localTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="flex-none rounded-[10px] border border-[var(--border)] px-3 text-sm text-[var(--text)]">+ Tipo</button>
        </div>
        {adding && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
            <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nuevo tipo (ej. VIP)" className={inputCls} />
            <button type="button" onClick={addType} disabled={creating || !newType.trim()}
              className="flex-none rounded-[10px] bg-[#0e7490] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "…" : "Crear"}
            </button>
          </div>
        )}
        {typeErr && <p className="mt-1 text-xs text-[#dc2626]">{typeErr}</p>}
      </div>
      <div><label className={labelCls}>Notas</label><textarea name="notes" defaultValue={values.notes ?? ""} rows={3} className={inputCls} /></div>

      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
