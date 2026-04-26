export const BRANDING = {
  platformName: "VerityAtlas",
  companyLegalName: "VerityAir Systems Ltd",
  backendStatusText: "VerityAtlas backend is running",
} as const;

export function productLabelWithLegacyName(): string {
  return `${BRANDING.platformName} (formerly FSMS)`;
}
