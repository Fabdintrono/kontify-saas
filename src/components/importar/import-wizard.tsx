"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, Download, CircleCheck, TriangleAlert, X } from "lucide-react";
import { revisarArchivo, confirmarImportacion } from "@/app/(app)/importar/actions";
import type { Revision } from "@/lib/import/analyze";
import type { Resultado } from "@/lib/import/commit";
import { plantillaCsv, mapear } from "@/lib/import/columns";
import { COLUMNAS, ETIQUETA, type Entidad } from "@/lib/import/entities";
import { EXTENSIONES } from "@/lib/import/sheet";
import { formatDateOnly } from "@/lib/format";
import { Button, Spinner } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FIELD_SM } from "@/components/ui/field";
import { DANGER_TEXT } from "@/lib/ui-tokens";
import { useToast } from "@/components/ui/toast";

const VISTA_PREVIA = 50;

/** Cómo se enseña un valor ya leído. La fecha va en la forma de aquí: la vista previa
 *  existe para confirmar que se entendió bien, y «2026-11-02» es justo lo que no se lee. */
function celda(v: string | number | null, tipo: string): string {
  if (v === null || v === "") return "—";
  return tipo === "fecha" ? formatDateOnly(String(v)) : String(v);
}

type Paso = "subir" | "revisar" | "listo";

export function ImportWizard({ entidad }: { entidad: Entidad }) {
  const columnas = COLUMNAS[entidad];
  const etiqueta = ETIQUETA[entidad];
  const router = useRouter();
  const { toast } = useToast();

  const [paso, setPaso] = useState<Paso>("subir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [trabajando, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function descargarPlantilla() {
    const csv = plantillaCsv(columnas);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla-${etiqueta.plural}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function analizar(f: File, mapeoManual?: Record<string, number>) {
    setError("");
    setArchivo(f);
    const fd = new FormData();
    fd.set("entidad", entidad);
    fd.set("archivo", f);
    if (mapeoManual) fd.set("mapeo", JSON.stringify(mapeoManual));
    start(async () => {
      const r = await revisarArchivo(fd);
      if (!r.ok) { setError(r.error); setRevision(null); return; }
      setRevision(r.revision);
      setPaso("revisar");
    });
  }

  function cambiarColumna(key: string, indice: number) {
    if (!revision || !archivo) return;
    analizar(archivo, { ...revision.mapeo, [key]: indice });
  }

  function confirmar() {
    if (!revision) return;
    setError("");
    start(async () => {
      const r = await confirmarImportacion(entidad, revision);
      if (!r.ok) { setError(r.error); return; }
      setResultado(r.resultado);
      setPaso("listo");
      toast({
        title: `Se importaron ${r.resultado.insertados} ${etiqueta.plural}`,
        href: etiqueta.volver, hrefLabel: `Ver ${etiqueta.plural}`,
      });
      router.refresh();
    });
  }

  function volverASubir() {
    setPaso("subir"); setRevision(null); setArchivo(null); setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      <Pasos actual={paso} />

      {error && (
        <p role="alert" className={`flex items-start gap-2 rounded-xl border border-[#b91c1c]/30 bg-[#b91c1c]/5 p-3 text-sm ${DANGER_TEXT}`}>
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {paso === "subir" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault(); setArrastrando(false);
              const f = e.dataTransfer.files[0];
              if (f) analizar(f);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-150 ${
              arrastrando ? "border-[#0e7490] bg-[#0e7490]/5" : "border-[var(--border)] bg-[var(--surface)]"}`}>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]">
              {trabajando ? <Spinner className="h-5 w-5" /> : <Upload className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--text)]">
              {trabajando ? "Leyendo el archivo" : "Arrastra tu archivo aquí"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Excel (.xlsx) o CSV, hasta 5 MB y 5000 filas.</p>

            <label htmlFor="archivo-import" className="sr-only">Elegir archivo</label>
            <input ref={inputRef} id="archivo-import" type="file" accept={EXTENSIONES.join(",")}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) analizar(f); }}
              className="sr-only" />
            <Button type="button" variant="secondary" className="mt-4" loading={trabajando}
              onClick={() => inputRef.current?.click()}>
              Elegir archivo
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">Cómo preparar tu archivo</p>
            <ol className="space-y-2 text-xs leading-relaxed text-[var(--text)]">
              <li><strong>1.</strong> Descarga la plantilla y copia tus datos dentro. O usa tu archivo tal cual: reconocemos los títulos más comunes.</li>
              <li><strong>2.</strong> La primera fila son los títulos. Las columnas con asterisco son obligatorias.</li>
              <li><strong>3.</strong> Súbelo. Antes de guardar nada verás una vista previa con los problemas marcados.</li>
            </ol>
            <Button type="button" variant="secondary" className="mt-3 w-full" onClick={descargarPlantilla}>
              <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Descargar plantilla
            </Button>

            <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">Columnas</p>
            <ul className="space-y-1.5">
              {columnas.map((c) => (
                <li key={c.key} className="text-xs text-[var(--text)]">
                  <span className="font-medium">{c.label}</span>
                  {c.obligatoria && <span className={`ml-1 ${DANGER_TEXT}`}>*</span>}
                  {c.ayuda && <span className="block text-[var(--text-soft)]">{c.ayuda}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {paso === "revisar" && revision && (
        <Revisar revision={revision} entidad={entidad} archivo={archivo}
          trabajando={trabajando} onCambiarColumna={cambiarColumna}
          onConfirmar={confirmar} onVolver={volverASubir} />
      )}

      {paso === "listo" && resultado && (
        <Listo resultado={resultado} entidad={entidad} onOtro={volverASubir} />
      )}
    </div>
  );
}

function Pasos({ actual }: { actual: Paso }) {
  const pasos: { id: Paso; label: string }[] = [
    { id: "subir", label: "Subir el archivo" },
    { id: "revisar", label: "Revisar" },
    { id: "listo", label: "Listo" },
  ];
  const i = pasos.findIndex((p) => p.id === actual);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {pasos.map((p, n) => {
        const hecho = n < i, activo = n === i;
        return (
          <li key={p.id} className="flex items-center gap-2">
            {n > 0 && <span aria-hidden="true" className="text-[var(--text-soft)]">›</span>}
            <span className={`flex items-center gap-1.5 ${activo ? "font-semibold text-[var(--text)]" : "text-[var(--text-soft)]"}`}>
              <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                hecho ? "bg-[#0f766e] text-white" : activo ? "bg-[#0e7490] text-white" : "border border-[var(--border)]"}`}>
                {hecho ? "✓" : n + 1}
              </span>
              {p.label}
              {activo && <span className="sr-only">(paso actual)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Revisar({ revision, entidad, archivo, trabajando, onCambiarColumna, onConfirmar, onVolver }: {
  revision: Revision; entidad: Entidad; archivo: File | null; trabajando: boolean;
  onCambiarColumna: (key: string, i: number) => void;
  onConfirmar: () => void; onVolver: () => void;
}) {
  const columnas = COLUMNAS[entidad];
  const etiqueta = ETIQUETA[entidad];
  const [soloErrores, setSoloErrores] = useState(false);
  const bloqueado = revision.faltantes.length > 0 || revision.validas === 0;

  const visibles = (soloErrores ? revision.filas.filter((f) => f.errores.length > 0) : revision.filas)
    .slice(0, VISTA_PREVIA);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-[var(--text-soft)]" strokeWidth={2} aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{archivo?.name}</p>
            <p className="text-xs text-[var(--text-soft)]">
              {revision.filas.length} filas leídas · <span className="font-semibold text-[#0f766e] dark:text-[#6ee7b7]">{revision.validas} listas</span>
              {revision.conError > 0 && <> · <span className={`font-semibold ${DANGER_TEXT}`}>{revision.conError} con problemas</span></>}
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={onVolver}>Cambiar archivo</Button>
      </div>

      {revision.faltantes.length > 0 && (
        <p role="alert" className={`rounded-xl border border-[#b91c1c]/30 bg-[#b91c1c]/5 p-3 text-sm ${DANGER_TEXT}`}>
          Tu archivo no trae {revision.faltantes.length === 1 ? "la columna" : "las columnas"} {revision.faltantes.join(", ")}.
          Empareja las columnas abajo o añádela a tu archivo.
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-bold text-[var(--text)]">Qué columna es cada cosa</h2>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">
          Las emparejamos solas por el título. Corrige la que haya quedado mal.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {columnas.map((c) => (
            <div key={c.key}>
              <label htmlFor={`map-${c.key}`} className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {c.label}{c.obligatoria && <span className={DANGER_TEXT}> *</span>}
              </label>
              <select id={`map-${c.key}`} value={revision.mapeo[c.key]} disabled={trabajando}
                onChange={(e) => onCambiarColumna(c.key, Number(e.target.value))}
                className={`${FIELD_SM} w-full ${revision.mapeo[c.key] < 0 && c.obligatoria ? "border-[#b91c1c]" : ""}`}>
                <option value={-1}>Ninguna</option>
                {revision.cabeceras.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
              </select>
            </div>
          ))}
        </div>
        {revision.ignoradas.length > 0 && (
          <p className="mt-3 text-xs text-[var(--text-soft)]">
            No se usarán: {revision.ignoradas.join(", ")}.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 lg:px-0">
          <h2 className="text-sm font-bold text-[var(--text)]">Vista previa</h2>
          {revision.conError > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--text)]">
              <input type="checkbox" checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} />
              Ver solo las {revision.conError} con problemas
            </label>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Vista previa de lo que se va a importar</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-soft)]">
                <th scope="col" className="px-2 py-2 text-left font-medium">Fila</th>
                {columnas.map((c) => <th key={c.key} scope="col" className="px-2 py-2 text-left font-medium">{c.label}</th>)}
                <th scope="col" className="px-2 py-2 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const malas = new Set(f.errores.map((e) => e.columna));
                return (
                  <tr key={f.linea} className="border-b border-[var(--border)] align-top">
                    <td className="px-2 py-2 tabular-nums text-[var(--text-soft)]">{f.linea}</td>
                    {columnas.map((c) => (
                      <td key={c.key} className={`max-w-[18ch] truncate px-2 py-2 ${malas.has(c.key) ? DANGER_TEXT : "text-[var(--text)]"}`}>
                        {celda(f.valores[c.key], c.tipo)}
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      {f.errores.length === 0
                        ? <StatusBadge tone="ok" icon="check" label="Lista" />
                        : <span className={`text-xs ${DANGER_TEXT}`}>{f.errores.map((e) => e.mensaje).join(". ")}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {revision.filas.length > VISTA_PREVIA && (
          <p className="mt-3 px-2 text-xs text-[var(--text-soft)] lg:px-0">
            Se muestran las primeras {VISTA_PREVIA}. Se importarán las {revision.validas} que estén listas.
          </p>
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:-mx-6 sm:px-6">
        <p className="text-xs text-[var(--text-soft)]">
          {bloqueado
            ? "Corrige lo de arriba para poder importar."
            : revision.conError > 0
              ? `Se guardarán ${revision.validas}. Las ${revision.conError} con problemas se quedan fuera.`
              : `Se guardarán ${revision.validas} ${etiqueta.plural}.`}
        </p>
        <div className="flex items-center gap-2">
          <Link href={etiqueta.volver}
            className="inline-flex h-10 items-center rounded-[10px] px-3 text-sm font-medium text-[var(--text-soft)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)]">
            Cancelar
          </Link>
          <Button type="button" variant="primary" disabled={bloqueado} loading={trabajando} onClick={onConfirmar}>
            Importar {revision.validas} {revision.validas === 1 ? etiqueta.singular : etiqueta.plural}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Listo({ resultado, entidad, onOtro }: { resultado: Resultado; entidad: Entidad; onOtro: () => void }) {
  const etiqueta = ETIQUETA[entidad];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#0f766e]/10 text-[#0f766e] dark:text-[#6ee7b7]">
        <CircleCheck className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <p className="mt-3 text-base font-bold text-[var(--text)]">
        {resultado.insertados} {resultado.insertados === 1 ? etiqueta.singular : etiqueta.plural} {resultado.insertados === 1 ? "importado" : "importados"}
      </p>
      {resultado.creadas.length > 0 && (
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          También se crearon: {resultado.creadas.join(", ")}.
        </p>
      )}
      {resultado.rechazadas.length > 0 && (
        <div className="mx-auto mt-4 max-w-xl rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-left">
          <p className={`mb-1 flex items-center gap-1.5 text-xs font-bold ${DANGER_TEXT}`}>
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            {resultado.rechazadas.length} {resultado.rechazadas.length === 1 ? "fila no entró" : "filas no entraron"}
          </p>
          <ul className="space-y-0.5">
            {resultado.rechazadas.slice(0, 20).map((r) => (
              <li key={r.linea} className="text-xs text-[var(--text)]">Fila {r.linea}: {r.motivo}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href={etiqueta.volver} className="inline-flex h-10 items-center rounded-[10px] bg-[#0e7490] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#0c6178] active:scale-[0.98]">
          Ver {etiqueta.plural}
        </Link>
        <Button type="button" variant="secondary" onClick={onOtro}>Importar otro archivo</Button>
      </div>
    </div>
  );
}
