import type { Doc } from "#convex/_generated/dataModel";

export function isOrganizationOnboarded(organization: Doc<"organizations">) {
  const required = [
    organization.name,
    organization.siren,
    organization.siret,
    organization.address,
    organization.postalCode,
    organization.city,
    organization.country,
    organization.paymentTermsText,
    organization.latePenaltyText,
    organization.discountTermsText,
    organization.quotePricingText,
  ];
  const vatReady = organization.defaultVatRate > 0 ? !!organization.vatNumber?.trim() : !!organization.taxExemptionText?.trim();
  return required.every((value) => !!value?.trim()) && vatReady;
}
