export interface SmsFrameworkSource {
  code: string;
  title: string;
  sourceType: string;
  versionLabel: string | null;
  sourceUrl: string | null;
  notes: string | null;
  displayOrder: number;
}

export interface SmsElement {
  code: string;
  pillarCode: string;
  elementNumber: string;
  title: string;
  displayOrder: number;
  sourceCode: string;
}

export interface SmsPillar {
  code: string;
  title: string;
  displayOrder: number;
  sourceCode: string;
  elements: SmsElement[];
}

export interface SmsFramework {
  sources: SmsFrameworkSource[];
  pillars: SmsPillar[];
}
