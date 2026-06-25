import { useMutation, useQuery } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "#convex/_generated/api";
import { Button, Field, FormSection, Notice, NumberInput, PageHeader, Panel, SelectInput, TextArea, TextInput } from "@/components/ui/app";
import { formNumber, formOptionalString } from "@/lib/format";

export function SettingsPage() {
  const current = useQuery(api.app.current);
  const updateOrganization = useMutation(api.app.updateOrganization);
  const organization = current?.organization;
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    const data = new FormData(event.currentTarget);

    try {
      await updateOrganization({
        name: String(data.get("name") ?? ""),
        legalName: formOptionalString(data.get("legalName")),
        legalForm: formOptionalString(data.get("legalForm")),
        shareCapital: formOptionalString(data.get("shareCapital")),
        siren: formOptionalString(data.get("siren")),
        siret: formOptionalString(data.get("siret")),
        vatNumber: formOptionalString(data.get("vatNumber")),
        apeCode: formOptionalString(data.get("apeCode")),
        registerNumber: formOptionalString(data.get("registerNumber")),
        registerCity: formOptionalString(data.get("registerCity")),
        email: formOptionalString(data.get("email")),
        phone: formOptionalString(data.get("phone")),
        address: formOptionalString(data.get("address")),
        postalCode: formOptionalString(data.get("postalCode")),
        city: formOptionalString(data.get("city")),
        country: formOptionalString(data.get("country")),
        logoUrl: formOptionalString(data.get("logoUrl")),
        defaultVatRate: formNumber(data.get("defaultVatRate"), 20),
        defaultHourlyRate: formNumber(data.get("defaultHourlyRate"), 0),
        defaultMarginRate: formNumber(data.get("defaultMarginRate"), 0),
        quotePrefix: formOptionalString(data.get("quotePrefix")),
        invoicePrefix: formOptionalString(data.get("invoicePrefix")),
        paymentTermsDays: formNumber(data.get("paymentTermsDays"), 30),
        quoteValidityDays: formNumber(data.get("quoteValidityDays"), 30),
        paymentTermsText: formOptionalString(data.get("paymentTermsText")),
        latePenaltyText: formOptionalString(data.get("latePenaltyText")),
        discountTermsText: formOptionalString(data.get("discountTermsText")),
        taxExemptionText: formOptionalString(data.get("taxExemptionText")),
        quotePricingText: formOptionalString(data.get("quotePricingText")),
        legalNotice: formOptionalString(data.get("legalNotice")),
        bankDetails: formOptionalString(data.get("bankDetails")),
        defaultOperationType: String(data.get("defaultOperationType") ?? "mixed") as "goods" | "services" | "mixed",
        taxDebitOption: String(data.get("taxDebitOption") ?? "false") === "true",
        professionalInsurance: formOptionalString(data.get("professionalInsurance")),
        mediatorInfo: formOptionalString(data.get("mediatorInfo")),
        acceptanceText: formOptionalString(data.get("acceptanceText")),
      });
      setNotice({ kind: "success", message: "Profil entreprise enregistre." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Enregistrement impossible" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entreprise"
        title="Mon entreprise"
        description="Les informations legales et valeurs par defaut utilisees dans les devis et factures."
      />

      <section className="company-hero">
        <div>
          <span>Profil actif</span>
          <strong>{organization?.name ?? "Chargement..."}</strong>
          <p>{organization?.email ?? "Complete les informations pour professionnaliser tes documents."}</p>
        </div>
        <div className="company-logo">
          {organization?.logoUrl ? <img src={organization.logoUrl} alt="" /> : "B"}
        </div>
      </section>

      <Panel title="Informations entreprise" description="Les champs obligatoires sont marques. Complete d'abord l'essentiel, puis les mentions legales utiles aux documents.">
        {!organization ? (
          <div className="empty-state"><strong>Chargement...</strong></div>
        ) : (
          <form className="company-form" onSubmit={handleSubmit}>
            {notice ? <Notice kind={notice.kind}>{notice.message}</Notice> : null}
            <FormSection title="Essentiel" description="Minimum conseille pour que les devis et factures aient une identite claire.">
              <Field label="Nom entreprise" required><TextInput name="name" defaultValue={organization.name} required /></Field>
              <Field label="Raison sociale" optional><TextInput name="legalName" defaultValue={organization.legalName ?? ""} /></Field>
              <Field label="Logo URL" optional><TextInput name="logoUrl" defaultValue={organization.logoUrl ?? ""} /></Field>
              <Field label="Email" optional><TextInput name="email" type="email" defaultValue={organization.email ?? ""} /></Field>
              <Field label="Telephone" optional><TextInput name="phone" defaultValue={organization.phone ?? ""} /></Field>
            </FormSection>

            <FormSection title="Identification legale" description="A completer selon ton statut. Ces informations apparaissent sur les documents client.">
              <Field label="Forme juridique" optional><TextInput name="legalForm" defaultValue={organization.legalForm ?? ""} placeholder="EI, SASU, SARL..." /></Field>
              <Field label="Capital social" optional><TextInput name="shareCapital" defaultValue={organization.shareCapital ?? ""} placeholder="Ex: 5 000 EUR" /></Field>
              <Field label="SIREN" optional><TextInput name="siren" defaultValue={organization.siren ?? ""} /></Field>
              <Field label="SIRET" optional><TextInput name="siret" defaultValue={organization.siret ?? ""} /></Field>
              <Field label="Numero TVA" optional><TextInput name="vatNumber" defaultValue={organization.vatNumber ?? ""} /></Field>
              <Field label="Code APE / NAF" optional><TextInput name="apeCode" defaultValue={organization.apeCode ?? ""} /></Field>
              <Field label="RCS / RM" optional><TextInput name="registerNumber" defaultValue={organization.registerNumber ?? ""} placeholder="Ex: RCS Paris 123 456 789" /></Field>
              <Field label="Ville greffe / registre" optional><TextInput name="registerCity" defaultValue={organization.registerCity ?? ""} /></Field>
            </FormSection>

            <FormSection title="Adresse" description="Adresse affichee dans l'en-tete des devis et factures.">
              <Field label="Adresse" optional><TextInput name="address" defaultValue={organization.address ?? ""} /></Field>
              <Field label="Code postal" optional><TextInput name="postalCode" defaultValue={organization.postalCode ?? ""} /></Field>
              <Field label="Ville" optional><TextInput name="city" defaultValue={organization.city ?? ""} /></Field>
              <Field label="Pays" optional><TextInput name="country" defaultValue={organization.country ?? "France"} /></Field>
            </FormSection>

            <FormSection title="Parametres documents" description="Valeurs reprises par defaut dans les nouveaux devis et factures.">
              <Field label="TVA par defaut (%)" required><NumberInput name="defaultVatRate" step="0.01" defaultValue={organization.defaultVatRate} /></Field>
              <Field label="Taux horaire defaut" optional><NumberInput name="defaultHourlyRate" step="0.01" defaultValue={organization.defaultHourlyRate ?? 0} /></Field>
              <Field label="Marge par defaut (%)" optional><NumberInput name="defaultMarginRate" step="0.01" defaultValue={organization.defaultMarginRate ?? 0} /></Field>
              <Field label="Prefixe devis" optional><TextInput name="quotePrefix" defaultValue={organization.quotePrefix ?? "D"} /></Field>
              <Field label="Prefixe factures" optional><TextInput name="invoicePrefix" defaultValue={organization.invoicePrefix ?? "F"} /></Field>
              <Field label="Delai paiement (jours)" optional><NumberInput name="paymentTermsDays" defaultValue={organization.paymentTermsDays ?? 30} /></Field>
              <Field label="Validite devis (jours)" optional><NumberInput name="quoteValidityDays" defaultValue={organization.quoteValidityDays ?? 30} /></Field>
              <Field label="Nature operation par defaut" optional>
                <SelectInput name="defaultOperationType" defaultValue={organization.defaultOperationType ?? "mixed"}>
                  <option value="mixed">Biens et services</option>
                  <option value="services">Services</option>
                  <option value="goods">Livraison de biens</option>
                </SelectInput>
              </Field>
              <Field label="TVA sur les debits" optional>
                <SelectInput name="taxDebitOption" defaultValue={organization.taxDebitOption ? "true" : "false"}>
                  <option value="false">Non</option>
                  <option value="true">Oui</option>
                </SelectInput>
              </Field>
            </FormSection>

            <FormSection title="Mentions legales et paiement" description="Textes affiches en bas des devis et factures. Tu peux les laisser vides si non applicables.">
              <Field label="Conditions de reglement" optional>
                <TextArea name="paymentTermsText" defaultValue={organization.paymentTermsText ?? ""} placeholder="Ex: acompte 30% a la commande, solde a reception." />
              </Field>
              <Field label="Penalites / retard" optional>
                <TextArea name="latePenaltyText" defaultValue={organization.latePenaltyText ?? ""} placeholder="Ex: penalites selon taux legal, indemnite forfaitaire 40 EUR." />
              </Field>
              <Field label="Escompte" optional>
                <TextArea name="discountTermsText" defaultValue={organization.discountTermsText ?? ""} placeholder="Ex: Escompte pour paiement anticipe: neant." />
              </Field>
              <Field label="Franchise TVA" optional>
                <TextArea name="taxExemptionText" defaultValue={organization.taxExemptionText ?? ""} placeholder="Ex: TVA non applicable, art. 293 B du CGI." />
              </Field>
              <Field label="Prix du devis" optional>
                <TextArea name="quotePricingText" defaultValue={organization.quotePricingText ?? ""} placeholder="Ex: Devis gratuit." />
              </Field>
              <Field label="Mentions devis" optional>
                <TextArea name="legalNotice" defaultValue={organization.legalNotice ?? ""} placeholder="Validite, reserves chantier, disponibilite materiaux..." />
              </Field>
              <Field label="Coordonnees bancaires" optional>
                <TextArea name="bankDetails" defaultValue={organization.bankDetails ?? ""} placeholder="IBAN, BIC, titulaire du compte..." />
              </Field>
              <Field label="Assurance professionnelle / decennale" optional>
                <TextArea name="professionalInsurance" defaultValue={organization.professionalInsurance ?? ""} placeholder="Assureur, contrat, zone geographique couverte..." />
              </Field>
              <Field label="Mediateur consommation" optional>
                <TextArea name="mediatorInfo" defaultValue={organization.mediatorInfo ?? ""} placeholder="Nom et coordonnees du mediateur applicable aux consommateurs." />
              </Field>
              <Field label="Acceptation devis" optional>
                <TextArea name="acceptanceText" defaultValue={organization.acceptanceText ?? ""} placeholder="Bon pour accord, date et signature..." />
              </Field>
            </FormSection>

            <div>
              <Button disabled={pending} type="submit"><Save className="h-4 w-4" />{pending ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
