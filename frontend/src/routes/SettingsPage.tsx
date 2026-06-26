import { useMutation, useQuery } from "convex/react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "#convex/_generated/api";
import { Field, FormSection, Notice, NumberInput, PageHeader, Panel, SelectInput, TextArea, TextInput } from "@/components/ui/app";
import { useBlurAutosave } from "@/hooks/useBlurAutosave";
import { formNumber, formOptionalString } from "@/lib/format";

export function SettingsPage() {
  const current = useQuery(api.app.current);
  const updateOrganization = useMutation(api.app.updateOrganization);
  const organization = current?.organization;
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [legalStructure, setLegalStructure] = useState<"individual" | "company">("individual");
  const [vatMode, setVatMode] = useState<"taxable" | "exempt">("taxable");
  const [hasRegister, setHasRegister] = useState(false);
  const [hasProfessionalInsurance, setHasProfessionalInsurance] = useState(false);
  const [hasConsumerMediator, setHasConsumerMediator] = useState(false);
  const autoSaveOrganizationOnBlur = useBlurAutosave<HTMLFormElement>((form) => {
    void saveOrganization(form, "auto");
  }, { enabled: !!organization });

  useEffect(() => {
    if (!organization) {
      return;
    }
    setLegalStructure(inferLegalStructure(organization.legalForm, organization.shareCapital));
    setVatMode(organization.defaultVatRate === 0 || !!organization.taxExemptionText && !organization.vatNumber ? "exempt" : "taxable");
    setHasRegister(!!organization.registerNumber || !!organization.registerCity);
    setHasProfessionalInsurance(!!organization.professionalInsurance);
    setHasConsumerMediator(!!organization.mediatorInfo);
  }, [organization]);

  async function saveOrganization(form: HTMLFormElement, mode: "auto" | "manual") {
    setNotice(null);
    const data = new FormData(form);

    try {
      await updateOrganization({
        name: String(data.get("name") ?? ""),
        legalName: formOptionalString(data.get("legalName")),
        legalForm: legalStructure === "company" ? formOptionalString(data.get("legalForm")) : undefined,
        shareCapital: legalStructure === "company" ? formOptionalString(data.get("shareCapital")) : undefined,
        siren: formOptionalString(data.get("siren")),
        siret: formOptionalString(data.get("siret")),
        vatNumber: vatMode === "taxable" ? formOptionalString(data.get("vatNumber")) : undefined,
        apeCode: formOptionalString(data.get("apeCode")),
        registerNumber: hasRegister ? formOptionalString(data.get("registerNumber")) : undefined,
        registerCity: hasRegister ? formOptionalString(data.get("registerCity")) : undefined,
        email: formOptionalString(data.get("email")),
        phone: formOptionalString(data.get("phone")),
        address: formOptionalString(data.get("address")),
        postalCode: formOptionalString(data.get("postalCode")),
        city: formOptionalString(data.get("city")),
        country: formOptionalString(data.get("country")),
        logoUrl: formOptionalString(data.get("logoUrl")),
        defaultVatRate: vatMode === "taxable" ? formNumber(data.get("defaultVatRate"), 20) : 0,
        defaultHourlyRate: formNumber(data.get("defaultHourlyRate"), 0),
        defaultMarginRate: formNumber(data.get("defaultMarginRate"), 0),
        quotePrefix: formOptionalString(data.get("quotePrefix")),
        invoicePrefix: formOptionalString(data.get("invoicePrefix")),
        paymentTermsDays: formNumber(data.get("paymentTermsDays"), 30),
        quoteValidityDays: formNumber(data.get("quoteValidityDays"), 30),
        paymentTermsText: formOptionalString(data.get("paymentTermsText")),
        latePenaltyText: formOptionalString(data.get("latePenaltyText")),
        discountTermsText: formOptionalString(data.get("discountTermsText")),
        taxExemptionText: vatMode === "exempt" ? formOptionalString(data.get("taxExemptionText")) : undefined,
        quotePricingText: formOptionalString(data.get("quotePricingText")),
        legalNotice: formOptionalString(data.get("legalNotice")),
        bankDetails: formOptionalString(data.get("bankDetails")),
        defaultOperationType: String(data.get("defaultOperationType") ?? "mixed") as "goods" | "services" | "mixed",
        taxDebitOption: vatMode === "taxable" && String(data.get("taxDebitOption") ?? "false") === "true",
        professionalInsurance: hasProfessionalInsurance ? formOptionalString(data.get("professionalInsurance")) : undefined,
        mediatorInfo: hasConsumerMediator ? formOptionalString(data.get("mediatorInfo")) : undefined,
        acceptanceText: formOptionalString(data.get("acceptanceText")),
      });
      setNotice({ kind: "success", message: mode === "auto" ? "Sauvegarde automatique effectuee." : "Profil entreprise enregistre." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Enregistrement impossible" });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveOrganization(event.currentTarget, "manual");
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
          <form className="company-form" onBlurCapture={autoSaveOrganizationOnBlur} onSubmit={handleSubmit}>
            {notice ? <Notice kind={notice.kind}>{notice.message}</Notice> : null}
            <Notice kind="warning">
              Les champs changent selon le statut, le regime TVA et les obligations que tu actives.
            </Notice>
            <FormSection title="Essentiel" description="Identite de l'emetteur affichee sur les devis et factures.">
              <Field label="Nom commercial" required><TextInput name="name" defaultValue={organization.name} required /></Field>
              <Field label="Raison sociale" optional hint="A renseigner si differente du nom commercial."><TextInput name="legalName" defaultValue={organization.legalName ?? ""} /></Field>
              <Field label="Logo URL" optional><TextInput name="logoUrl" defaultValue={organization.logoUrl ?? ""} /></Field>
              <Field label="Email" optional hint="Recommande pour les documents client."><TextInput name="email" type="email" defaultValue={organization.email ?? ""} /></Field>
              <Field label="Telephone" optional hint="Recommande pour les documents client."><TextInput name="phone" defaultValue={organization.phone ?? ""} /></Field>
            </FormSection>

            <FormSection title="Identification legale" description="Informations d'immatriculation a reprendre dans les documents commerciaux.">
              <Field label="Statut de l'entreprise" required>
                <SelectInput value={legalStructure} onChange={(event) => setLegalStructure(event.target.value as typeof legalStructure)}>
                  <option value="individual">Entreprise individuelle / micro</option>
                  <option value="company">Societe</option>
                </SelectInput>
              </Field>
              {legalStructure === "company" ? (
                <>
                  <Field label="Forme juridique" legalRequired><TextInput name="legalForm" defaultValue={organization.legalForm ?? ""} placeholder="SASU, SARL, EURL..." /></Field>
                  <Field label="Capital social" legalRequired><TextInput name="shareCapital" defaultValue={organization.shareCapital ?? ""} placeholder="Ex: 5 000 EUR" /></Field>
                </>
              ) : null}
              <Field label="SIREN" legalRequired><TextInput name="siren" defaultValue={organization.siren ?? ""} /></Field>
              <Field label="SIRET" legalRequired><TextInput name="siret" defaultValue={organization.siret ?? ""} /></Field>
              <Field label="Code APE / NAF" optional><TextInput name="apeCode" defaultValue={organization.apeCode ?? ""} /></Field>
              <Field label="Immatriculation RCS / RM" required>
                <SelectInput value={hasRegister ? "yes" : "no"} onChange={(event) => setHasRegister(event.target.value === "yes")}>
                  <option value="no">Non / non applicable</option>
                  <option value="yes">Oui</option>
                </SelectInput>
              </Field>
              {hasRegister ? (
                <>
                  <Field label="RCS / RM" legalRequired><TextInput name="registerNumber" defaultValue={organization.registerNumber ?? ""} placeholder="Ex: RCS Paris 123 456 789" /></Field>
                  <Field label="Ville greffe / registre" legalRequired><TextInput name="registerCity" defaultValue={organization.registerCity ?? ""} /></Field>
                </>
              ) : null}
            </FormSection>

            <FormSection title="Adresse" description="Adresse du siege ou de l'etablissement emetteur affichee dans l'en-tete des documents.">
              <Field label="Adresse" legalRequired><TextInput name="address" defaultValue={organization.address ?? ""} /></Field>
              <Field label="Code postal" legalRequired><TextInput name="postalCode" defaultValue={organization.postalCode ?? ""} /></Field>
              <Field label="Ville" legalRequired><TextInput name="city" defaultValue={organization.city ?? ""} /></Field>
              <Field label="Pays" legalRequired><TextInput name="country" defaultValue={organization.country ?? "France"} /></Field>
            </FormSection>

            <FormSection title="Parametres documents" description="Valeurs reprises par defaut dans les nouveaux devis et factures.">
              <Field label="Regime TVA" required>
                <SelectInput value={vatMode} onChange={(event) => setVatMode(event.target.value as typeof vatMode)}>
                  <option value="taxable">Assujetti a la TVA</option>
                  <option value="exempt">Franchise / TVA non applicable</option>
                </SelectInput>
              </Field>
              {vatMode === "taxable" ? (
                <>
                  <Field label="TVA par defaut (%)" required><NumberInput name="defaultVatRate" step="0.01" defaultValue={organization.defaultVatRate} /></Field>
                  <Field label="Numero TVA" legalRequired><TextInput name="vatNumber" defaultValue={organization.vatNumber ?? ""} /></Field>
                  <Field label="TVA sur les debits" required>
                    <SelectInput name="taxDebitOption" defaultValue={organization.taxDebitOption ? "true" : "false"}>
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </SelectInput>
                  </Field>
                </>
              ) : (
                <Field label="Franchise TVA" legalRequired>
                  <TextArea name="taxExemptionText" defaultValue={organization.taxExemptionText ?? ""} placeholder="Ex: TVA non applicable, art. 293 B du CGI." />
                </Field>
              )}
              <Field label="Taux horaire defaut" optional><NumberInput name="defaultHourlyRate" step="0.01" defaultValue={organization.defaultHourlyRate ?? 0} /></Field>
              <Field label="Marge par defaut (%)" optional><NumberInput name="defaultMarginRate" step="0.01" defaultValue={organization.defaultMarginRate ?? 0} /></Field>
              <Field label="Prefixe devis" optional><TextInput name="quotePrefix" defaultValue={organization.quotePrefix ?? "D"} /></Field>
              <Field label="Prefixe factures" optional><TextInput name="invoicePrefix" defaultValue={organization.invoicePrefix ?? "F"} /></Field>
              <Field label="Delai paiement (jours)" legalRequired><NumberInput name="paymentTermsDays" defaultValue={organization.paymentTermsDays ?? 30} /></Field>
              <Field label="Validite devis (jours)" legalRequired><NumberInput name="quoteValidityDays" defaultValue={organization.quoteValidityDays ?? 30} /></Field>
              <Field label="Nature operation par defaut" legalRequired>
                <SelectInput name="defaultOperationType" defaultValue={organization.defaultOperationType ?? "mixed"}>
                  <option value="mixed">Biens et services</option>
                  <option value="services">Services</option>
                  <option value="goods">Livraison de biens</option>
                </SelectInput>
              </Field>
            </FormSection>

            <FormSection title="Mentions legales et paiement" description="Textes affiches en bas des devis et factures. Tu peux les laisser vides si non applicables.">
              <Field label="Conditions de reglement" legalRequired>
                <TextArea name="paymentTermsText" defaultValue={organization.paymentTermsText ?? ""} placeholder="Ex: acompte 30% a la commande, solde a reception." />
              </Field>
              <Field label="Penalites / retard" legalRequired>
                <TextArea name="latePenaltyText" defaultValue={organization.latePenaltyText ?? ""} placeholder="Ex: penalites selon taux legal, indemnite forfaitaire 40 EUR." />
              </Field>
              <Field label="Escompte" legalRequired>
                <TextArea name="discountTermsText" defaultValue={organization.discountTermsText ?? ""} placeholder="Ex: Escompte pour paiement anticipe: neant." />
              </Field>
              <Field label="Prix du devis" legalRequired>
                <TextArea name="quotePricingText" defaultValue={organization.quotePricingText ?? ""} placeholder="Ex: Devis gratuit." />
              </Field>
              <Field label="Mentions devis" optional>
                <TextArea name="legalNotice" defaultValue={organization.legalNotice ?? ""} placeholder="Validite, reserves chantier, disponibilite materiaux..." />
              </Field>
              <Field label="Coordonnees bancaires" optional>
                <TextArea name="bankDetails" defaultValue={organization.bankDetails ?? ""} placeholder="IBAN, BIC, titulaire du compte..." />
              </Field>
              <Field label="Assurance obligatoire" required>
                <SelectInput value={hasProfessionalInsurance ? "yes" : "no"} onChange={(event) => setHasProfessionalInsurance(event.target.value === "yes")}>
                  <option value="no">Non / non applicable</option>
                  <option value="yes">Oui</option>
                </SelectInput>
              </Field>
              {hasProfessionalInsurance ? (
                <Field label="Assurance professionnelle / decennale" legalRequired>
                  <TextArea name="professionalInsurance" defaultValue={organization.professionalInsurance ?? ""} placeholder="Assureur, contrat, zone geographique couverte..." />
                </Field>
              ) : null}
              <Field label="Clients consommateurs" required>
                <SelectInput value={hasConsumerMediator ? "yes" : "no"} onChange={(event) => setHasConsumerMediator(event.target.value === "yes")}>
                  <option value="no">Non</option>
                  <option value="yes">Oui</option>
                </SelectInput>
              </Field>
              {hasConsumerMediator ? (
                <Field label="Mediateur consommation" legalRequired>
                  <TextArea name="mediatorInfo" defaultValue={organization.mediatorInfo ?? ""} placeholder="Nom et coordonnees du mediateur applicable aux consommateurs." />
                </Field>
              ) : null}
              <Field label="Acceptation devis" optional>
                <TextArea name="acceptanceText" defaultValue={organization.acceptanceText ?? ""} placeholder="Bon pour accord, date et signature..." />
              </Field>
            </FormSection>
          </form>
        )}
      </Panel>
    </div>
  );
}

function inferLegalStructure(legalForm: string | undefined, shareCapital: string | undefined): "individual" | "company" {
  if (shareCapital?.trim()) {
    return "company";
  }
  const normalized = legalForm?.trim().toLowerCase();
  if (!normalized) {
    return "individual";
  }
  return normalized.includes("ei") || normalized.includes("micro") || normalized.includes("auto") ? "individual" : "company";
}
