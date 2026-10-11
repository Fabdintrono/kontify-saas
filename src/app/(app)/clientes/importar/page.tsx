import { ImportWizard } from "@/components/importar/import-wizard";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";

export default function ImportarClientesPage() {
  return (
    <Page>
      <FormHeader backHref="/clientes" backLabel="Clientes" title="Importar clientes"
        subtitle="Trae tu cartera desde Excel o desde un CSV. Verás una vista previa antes de guardar nada." />
      <ImportWizard entidad="clientes" />
    </Page>
  );
}
