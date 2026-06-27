import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  FileCheck2,
  LogOut,
  Scale,
  Sparkles,
} from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { BooriseMark } from "@/components/brand/BooriseLogo";
import {
  Button,
  Field,
  FormSection,
  Notice,
  NumberInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { friendlyError } from "@/lib/errors";
import { formNumber, formOptionalString } from "@/lib/format";

type OrganizationFormPayload = Parameters<
  ReturnType<typeof useMutation<typeof api.app.createOrganization>>
>[0];

export function OnboardingPage({
  organization,
}: {
  organization?: Doc<"organizations"> | null;
}) {
  const { signOut } = useAuthActions();
  const toast = useToast();
  const createOrganization = useMutation(api.app.createOrganization);
  const updateOrganization = useMutation(api.app.updateOrganization);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalStructure, setLegalStructure] = useState<
    "individual" | "company"
  >("individual");
  const [vatMode, setVatMode] = useState<"taxable" | "exempt">("taxable");
  const [hasRegister, setHasRegister] = useState(false);
  const [hasProfessionalInsurance, setHasProfessionalInsurance] =
    useState(false);
  const [hasConsumerMediator, setHasConsumerMediator] = useState(false);

  useEffect(() => {
    if (!organization) {
      return;
    }
    setLegalStructure(
      inferLegalStructure(organization.legalForm, organization.shareCapital),
    );
    setVatMode(
      organization.defaultVatRate === 0 ||
        (!!organization.taxExemptionText && !organization.vatNumber)
        ? "exempt"
        : "taxable",
    );
    setHasRegister(
      !!organization.registerNumber || !!organization.registerCity,
    );
    setHasProfessionalInsurance(!!organization.professionalInsurance);
    setHasConsumerMediator(!!organization.mediatorInfo);
  }, [organization]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const payload = buildPayload(new FormData(event.currentTarget), {
        legalStructure,
        vatMode,
        hasRegister,
        hasProfessionalInsurance,
        hasConsumerMediator,
      });
      if (organization) {
        await updateOrganization(payload);
      } else {
        await createOrganization(payload);
      }
      toast.success(
        organization ? "Entreprise completee." : "Espace entreprise cree.",
      );
    } catch (err) {
      const message = friendlyError(err, "Configuration impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="onboarding-screen">
      <form
        className="onboarding-card onboarding-card-wide"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="brand-row px-0">
            <BooriseMark />
            <div>
              <div className="text-sm font-bold text-slate-950">Boorise</div>
              <div className="text-xs text-slate-500">
                Onboarding entreprise
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sortir
          </Button>
        </div>

        <div className="onboarding-intro">
          <div>
            <span className="onboarding-kicker">
              <Sparkles className="h-4 w-4" /> Depart propre
            </span>
            <h1>
              {organization
                ? "Complete ton passeport entreprise"
                : "Configure ton passeport entreprise"}
            </h1>
            <p>
              On remplit seulement ce qui rend tes devis et factures
              exploitables. L'ERP s'ouvre quand ton identite, ton adresse, ta
              TVA et tes mentions de paiement sont solides.
            </p>
          </div>
          <div className="onboarding-steps" aria-label="Etapes obligatoires">
            <span>
              <Building2 className="h-4 w-4" /> Identite
            </span>
            <span>
              <Scale className="h-4 w-4" /> Legal
            </span>
            <span>
              <FileCheck2 className="h-4 w-4" /> Documents
            </span>
          </div>
        </div>

        {error ? <Notice kind="error">{error}</Notice> : null}
        <Notice kind="warning">
          Les badges "Legal obligatoire" indiquent les champs requis avant
          d'entrer dans l'ERP.
        </Notice>

        <FormSection
          title="Identite entreprise"
          description="Nom public, contact et informations affichees en haut des documents."
        >
          <Field label="Nom commercial" legalRequired>
            <TextInput
              name="name"
              defaultValue={organization?.name ?? ""}
              placeholder="Atelier Martin"
              required
            />
          </Field>
          <Field label="Raison sociale" optional>
            <TextInput
              name="legalName"
              defaultValue={organization?.legalName ?? ""}
              placeholder="Si differente du nom commercial"
            />
          </Field>
          <Field
            label="Email entreprise"
            required
            hint="Utilise en contact client et reply-to des emails."
          >
            <TextInput
              name="email"
              type="email"
              defaultValue={organization?.email ?? ""}
              placeholder="contact@entreprise.fr"
              required
            />
          </Field>
          <Field label="Telephone" optional>
            <TextInput
              name="phone"
              defaultValue={organization?.phone ?? ""}
              placeholder="06 00 00 00 00"
            />
          </Field>
          <Field label="Logo URL" optional>
            <TextInput
              name="logoUrl"
              defaultValue={organization?.logoUrl ?? ""}
              placeholder="https://..."
            />
          </Field>
        </FormSection>

        <FormSection
          title="Identification legale"
          description="Immatriculation et adresse du siege ou de l'etablissement emetteur."
        >
          <Field label="Statut de l'entreprise" required>
            <SelectInput
              value={legalStructure}
              onChange={(event) =>
                setLegalStructure(event.target.value as typeof legalStructure)
              }
            >
              <option value="individual">
                Entreprise individuelle / micro
              </option>
              <option value="company">Societe</option>
            </SelectInput>
          </Field>
          {legalStructure === "company" ? (
            <>
              <Field label="Forme juridique" legalRequired>
                <TextInput
                  name="legalForm"
                  defaultValue={organization?.legalForm ?? ""}
                  placeholder="SASU, SARL, EURL..."
                  required
                />
              </Field>
              <Field label="Capital social" legalRequired>
                <TextInput
                  name="shareCapital"
                  defaultValue={organization?.shareCapital ?? ""}
                  placeholder="Ex: 5 000 EUR"
                  required
                />
              </Field>
            </>
          ) : null}
          <Field label="SIREN" legalRequired>
            <TextInput
              name="siren"
              defaultValue={organization?.siren ?? ""}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="SIRET" legalRequired>
            <TextInput
              name="siret"
              defaultValue={organization?.siret ?? ""}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="Code APE / NAF" optional>
            <TextInput
              name="apeCode"
              defaultValue={organization?.apeCode ?? ""}
              placeholder="Ex: 4332A"
            />
          </Field>
          <Field label="Immatriculation RCS / RM" required>
            <SelectInput
              value={hasRegister ? "yes" : "no"}
              onChange={(event) => setHasRegister(event.target.value === "yes")}
            >
              <option value="no">Non / non applicable</option>
              <option value="yes">Oui</option>
            </SelectInput>
          </Field>
          {hasRegister ? (
            <>
              <Field label="RCS / RM" legalRequired>
                <TextInput
                  name="registerNumber"
                  defaultValue={organization?.registerNumber ?? ""}
                  placeholder="Ex: RCS Paris 123 456 789"
                  required
                />
              </Field>
              <Field label="Ville greffe / registre" legalRequired>
                <TextInput
                  name="registerCity"
                  defaultValue={organization?.registerCity ?? ""}
                  required
                />
              </Field>
            </>
          ) : null}
          <Field label="Adresse" legalRequired>
            <TextInput
              name="address"
              defaultValue={organization?.address ?? ""}
              required
            />
          </Field>
          <Field label="Code postal" legalRequired>
            <TextInput
              name="postalCode"
              defaultValue={organization?.postalCode ?? ""}
              required
            />
          </Field>
          <Field label="Ville" legalRequired>
            <TextInput
              name="city"
              defaultValue={organization?.city ?? ""}
              required
            />
          </Field>
          <Field label="Pays" legalRequired>
            <TextInput
              name="country"
              defaultValue={organization?.country ?? "France"}
              required
            />
          </Field>
        </FormSection>

        <FormSection
          title="TVA et documents"
          description="Valeurs par defaut reprises dans les nouveaux devis et factures."
        >
          <Field label="Regime TVA" required>
            <SelectInput
              value={vatMode}
              onChange={(event) =>
                setVatMode(event.target.value as typeof vatMode)
              }
            >
              <option value="taxable">Assujetti a la TVA</option>
              <option value="exempt">Franchise / TVA non applicable</option>
            </SelectInput>
          </Field>
          {vatMode === "taxable" ? (
            <>
              <Field label="TVA par defaut (%)" required>
                <NumberInput
                  name="defaultVatRate"
                  min={0.01}
                  max={100}
                  step="0.01"
                  defaultValue={organization?.defaultVatRate ?? 20}
                  required
                />
              </Field>
              <Field label="Numero TVA" legalRequired>
                <TextInput
                  name="vatNumber"
                  defaultValue={organization?.vatNumber ?? ""}
                  placeholder="FR..."
                  required
                />
              </Field>
              <Field label="TVA sur les debits" required>
                <SelectInput
                  name="taxDebitOption"
                  defaultValue={organization?.taxDebitOption ? "true" : "false"}
                >
                  <option value="false">Non</option>
                  <option value="true">Oui</option>
                </SelectInput>
              </Field>
            </>
          ) : (
            <Field label="Mention franchise TVA" legalRequired>
              <TextArea
                name="taxExemptionText"
                defaultValue={organization?.taxExemptionText ?? ""}
                placeholder="TVA non applicable, art. 293 B du CGI."
                required
              />
            </Field>
          )}
          <Field label="Delai paiement (jours)" legalRequired>
            <NumberInput
              name="paymentTermsDays"
              min={0}
              max={365}
              step={1}
              defaultValue={organization?.paymentTermsDays ?? 30}
              required
            />
          </Field>
          <Field label="Validite devis (jours)" legalRequired>
            <NumberInput
              name="quoteValidityDays"
              min={1}
              max={365}
              step={1}
              defaultValue={organization?.quoteValidityDays ?? 30}
              required
            />
          </Field>
          <Field label="Nature operation" legalRequired>
            <SelectInput
              name="defaultOperationType"
              defaultValue={organization?.defaultOperationType ?? "mixed"}
            >
              <option value="mixed">Biens et services</option>
              <option value="services">Services</option>
              <option value="goods">Livraison de biens</option>
            </SelectInput>
          </Field>
          <Field label="Taux horaire defaut" optional>
            <NumberInput
              name="defaultHourlyRate"
              min={0}
              step="0.01"
              defaultValue={organization?.defaultHourlyRate ?? 0}
            />
          </Field>
          <Field label="Marge par defaut (%)" optional>
            <NumberInput
              name="defaultMarginRate"
              min={0}
              max={100}
              step="0.01"
              defaultValue={organization?.defaultMarginRate ?? 0}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Mentions obligatoires"
          description="Textes generiques repris dans les documents client."
        >
          <Field label="Conditions de reglement" legalRequired>
            <TextArea
              name="paymentTermsText"
              defaultValue={
                organization?.paymentTermsText ??
                "Acompte de 30% a la commande, solde a la reception des travaux."
              }
              required
            />
          </Field>
          <Field label="Penalites / retard" legalRequired>
            <TextArea
              name="latePenaltyText"
              defaultValue={
                organization?.latePenaltyText ??
                "Penalites de retard selon le taux legal en vigueur. Indemnite forfaitaire de recouvrement: 40 EUR."
              }
              required
            />
          </Field>
          <Field label="Escompte" legalRequired>
            <TextArea
              name="discountTermsText"
              defaultValue={
                organization?.discountTermsText ??
                "Escompte pour paiement anticipe: neant."
              }
              required
            />
          </Field>
          <Field label="Prix du devis" legalRequired>
            <TextArea
              name="quotePricingText"
              defaultValue={organization?.quotePricingText ?? "Devis gratuit."}
              required
            />
          </Field>
          <Field label="Mentions devis" optional>
            <TextArea
              name="legalNotice"
              defaultValue={
                organization?.legalNotice ??
                "Devis valable sous reserve de disponibilite des materiaux et d'acces normal au chantier."
              }
            />
          </Field>
          <Field label="Assurance obligatoire" required>
            <SelectInput
              value={hasProfessionalInsurance ? "yes" : "no"}
              onChange={(event) =>
                setHasProfessionalInsurance(event.target.value === "yes")
              }
            >
              <option value="no">Non / non applicable</option>
              <option value="yes">Oui</option>
            </SelectInput>
          </Field>
          {hasProfessionalInsurance ? (
            <Field label="Assurance professionnelle / decennale" legalRequired>
              <TextArea
                name="professionalInsurance"
                defaultValue={organization?.professionalInsurance ?? ""}
                placeholder="Assureur, contrat, zone geographique couverte..."
                required
              />
            </Field>
          ) : null}
          <Field label="Clients consommateurs" required>
            <SelectInput
              value={hasConsumerMediator ? "yes" : "no"}
              onChange={(event) =>
                setHasConsumerMediator(event.target.value === "yes")
              }
            >
              <option value="no">Non</option>
              <option value="yes">Oui</option>
            </SelectInput>
          </Field>
          {hasConsumerMediator ? (
            <Field label="Mediateur consommation" legalRequired>
              <TextArea
                name="mediatorInfo"
                defaultValue={organization?.mediatorInfo ?? ""}
                placeholder="Nom et coordonnees du mediateur applicable aux consommateurs."
                required
              />
            </Field>
          ) : null}
          <Field label="Acceptation devis" optional>
            <TextArea
              name="acceptanceText"
              defaultValue={
                organization?.acceptanceText ??
                "Bon pour accord, date et signature precedees de la mention manuscrite."
              }
            />
          </Field>
        </FormSection>

        <div className="onboarding-footer">
          <span>
            Tu pourras modifier ces informations plus tard dans Mon entreprise.
          </span>
          <Button disabled={pending} type="submit">
            {pending
              ? "Validation..."
              : organization
                ? "Terminer l'onboarding"
                : "Creer mon espace"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </main>
  );
}

function buildPayload(
  data: FormData,
  options: {
    legalStructure: "individual" | "company";
    vatMode: "taxable" | "exempt";
    hasRegister: boolean;
    hasProfessionalInsurance: boolean;
    hasConsumerMediator: boolean;
  },
): OrganizationFormPayload {
  return {
    name: String(data.get("name") ?? ""),
    legalName: formOptionalString(data.get("legalName")),
    legalForm:
      options.legalStructure === "company"
        ? formOptionalString(data.get("legalForm"))
        : undefined,
    shareCapital:
      options.legalStructure === "company"
        ? formOptionalString(data.get("shareCapital"))
        : undefined,
    siren: formOptionalString(data.get("siren")),
    siret: formOptionalString(data.get("siret")),
    vatNumber:
      options.vatMode === "taxable"
        ? formOptionalString(data.get("vatNumber"))
        : undefined,
    apeCode: formOptionalString(data.get("apeCode")),
    registerNumber: options.hasRegister
      ? formOptionalString(data.get("registerNumber"))
      : undefined,
    registerCity: options.hasRegister
      ? formOptionalString(data.get("registerCity"))
      : undefined,
    email: formOptionalString(data.get("email")),
    phone: formOptionalString(data.get("phone")),
    address: formOptionalString(data.get("address")),
    postalCode: formOptionalString(data.get("postalCode")),
    city: formOptionalString(data.get("city")),
    country: formOptionalString(data.get("country")),
    logoUrl: formOptionalString(data.get("logoUrl")),
    defaultVatRate:
      options.vatMode === "taxable"
        ? formNumber(data.get("defaultVatRate"), 20, { min: 0.01, max: 100 })
        : 0,
    defaultHourlyRate: formNumber(data.get("defaultHourlyRate"), 0, { min: 0 }),
    defaultMarginRate: formNumber(data.get("defaultMarginRate"), 0, {
      min: 0,
      max: 100,
    }),
    quotePrefix: "D",
    invoicePrefix: "F",
    paymentTermsDays: formNumber(data.get("paymentTermsDays"), 30, {
      min: 0,
      max: 365,
    }),
    quoteValidityDays: formNumber(data.get("quoteValidityDays"), 30, {
      min: 1,
      max: 365,
    }),
    paymentTermsText: formOptionalString(data.get("paymentTermsText")),
    latePenaltyText: formOptionalString(data.get("latePenaltyText")),
    discountTermsText: formOptionalString(data.get("discountTermsText")),
    taxExemptionText:
      options.vatMode === "exempt"
        ? formOptionalString(data.get("taxExemptionText"))
        : undefined,
    quotePricingText: formOptionalString(data.get("quotePricingText")),
    legalNotice: formOptionalString(data.get("legalNotice")),
    bankDetails: undefined,
    defaultOperationType: String(
      data.get("defaultOperationType") ?? "mixed",
    ) as "goods" | "services" | "mixed",
    taxDebitOption:
      options.vatMode === "taxable" &&
      String(data.get("taxDebitOption") ?? "false") === "true",
    professionalInsurance: options.hasProfessionalInsurance
      ? formOptionalString(data.get("professionalInsurance"))
      : undefined,
    mediatorInfo: options.hasConsumerMediator
      ? formOptionalString(data.get("mediatorInfo"))
      : undefined,
    acceptanceText: formOptionalString(data.get("acceptanceText")),
  };
}

function inferLegalStructure(
  legalForm: string | undefined,
  shareCapital: string | undefined,
): "individual" | "company" {
  if (shareCapital?.trim()) {
    return "company";
  }
  const normalized = legalForm?.trim().toLowerCase();
  if (!normalized) {
    return "individual";
  }
  return normalized.includes("ei") ||
    normalized.includes("micro") ||
    normalized.includes("auto")
    ? "individual"
    : "company";
}
