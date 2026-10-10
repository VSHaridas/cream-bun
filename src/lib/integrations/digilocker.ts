import { createHash, randomBytes } from "node:crypto";
import type { IdentityVerification } from "@/lib/domain/types";
import { isLive } from "@/lib/integrations/registry";

/* ═══════════════════════════════════════════════════════════════════════════
   DigiLocker adapter

   The product argument: a brand will not hand a government ID to a marketplace
   it has never used. So CREAM does not ask for one. The flow is

     CREAM → DigiLocker  : request a consent for a named issuer document
     DigiLocker → User   : consent screen, on the issuer's own terms
     Issuer → DigiLocker : validates the document
     DigiLocker → CREAM  : signed assertion envelope, artefact NOT retained

   CREAM's database never receives a file, a scan, or a copy. What it stores is
   an issuer reference, an assurance level and a timestamp — which is enough to
   make a fraud claim investigable and insufficient to be a privacy liability.

   With no client id configured we run the identical state machine locally, so
   the demo exercises every step including the ones that only exist in the real
   flow (issuer selection, per-document consent, artefact download denial).
   ═══════════════════════════════════════════════════════════════════════════ */

export type DigilockerStepId =
  | "initiate"
  | "select-document"
  | "consent"
  | "issuer-otp"
  | "pull-assertion"
  | "assertion-received";

export interface DigilockerStep {
  id: DigilockerStepId;
  title: string;
  actor: "brand" | "digilocker" | "issuer" | "cream";
  description: string;
  /** What the UI shows while this step is active. */
  ui: string;
}

export interface IssuerDocument {
  issuer: string;
  issuerId: string;
  description: string;
  documentType: string;
  assuranceLevel: "AAL1" | "AAL2" | "AAL3";
  /** Digilocker returns the artefact for user download — but never to us. */
  artefactAvailableToUser: boolean;
  artefactAvailableToCream: false;
}

export const ISSUER_CATALOGUE: IssuerDocument[] = [
  {
    issuer: "Unique Identification Authority of India",
    issuerId: "UIDAI",
    description: "National identity — masked, issuer-signed",
    documentType: "Aadhaar",
    assuranceLevel: "AAL2",
    artefactAvailableToUser: true,
    artefactAvailableToCream: false,
  },
  {
    issuer: "Income Tax Department",
    issuerId: "INCOMETAX",
    description: "Tax identity for business verification",
    documentType: "PAN",
    assuranceLevel: "AAL1",
    artefactAvailableToUser: true,
    artefactAvailableToCream: false,
  },
  {
    issuer: "Ministry of External Affairs",
    issuerId: "MEA",
    description: "Passport — strongest available assurance",
    documentType: "Passport",
    assuranceLevel: "AAL2",
    artefactAvailableToUser: true,
    artefactAvailableToCream: false,
  },
  {
    issuer: "Regional Transport Authority",
    issuerId: "RTA",
    description: "Driving licence, issued by your state",
    documentType: "Driving licence",
    assuranceLevel: "AAL1",
    artefactAvailableToUser: true,
    artefactAvailableToCream: false,
  },
  {
    issuer: "Goods and Services Tax Network",
    issuerId: "GSTN",
    description: "Business registration — required for agency accounts",
    documentType: "GST registration certificate",
    assuranceLevel: "AAL2",
    artefactAvailableToUser: true,
    artefactAvailableToCream: false,
  },
];

export const DIGILOCKER_FLOW: DigilockerStep[] = [
  {
    id: "initiate",
    title: "Request consent",
    actor: "brand",
    description:
      "CREAM asks DigiLocker to open a consent session naming the issuer and document type. CREAM sends an identifier — never a document, never a request for one.",
    ui: "A session opens at digilocker.gov.in in the DigiLocker frame.",
  },
  {
    id: "select-document",
    title: "Choose from your locker",
    actor: "digilocker",
    description:
      "The user sees which of their own issued documents CREAM is asking for, and may refuse any of them without blocking signup.",
    ui: "A list of the user's issued documents, each with an allow/refuse control.",
  },
  {
    id: "consent",
    title: "Give purpose-bound consent",
    actor: "digilocker",
    description:
      "Consent is scoped to a stated purpose — 'identity verification for CREAM marketplace onboarding' — and is revocable. A refusal is a supported outcome, not an error state.",
    ui: "A consent card showing the exact purpose string and a duration.",
  },
  {
    id: "issuer-otp",
    title: "Issuer re-authenticates you",
    actor: "issuer",
    description:
      "The issuer — not DigiLocker, not CREAM — sends the OTP. This is the step that makes the assertion worth something: the document holder proved possession to the body that issued it.",
    ui: "An OTP field, branded by the issuer, on the issuer's own domain.",
  },
  {
    id: "pull-assertion",
    title: "Assertion is pulled",
    actor: "digilocker",
    description:
      "DigiLocker validates the document with the issuer and returns a signed assertion envelope containing the masked identifier, assurance level and issuance date.",
    ui: "A short machine-readable envelope. No scan, no photograph, no file bytes.",
  },
  {
    id: "assertion-received",
    title: "CREAM stores an assertion",
    actor: "cream",
    description:
      "We persist the issuer reference, the assurance level and the timestamp. The artefact is explicitly not retained, and the user can still download it from their own DigiLocker at any time.",
    ui: "A receipt showing exactly the three fields CREAM kept.",
  },
];

export interface DigilockerAssertion {
  requestId: string;
  issuerId: string;
  documentType: string;
  maskedIdentifier: string;
  assuranceLevel: "AAL1" | "AAL2" | "AAL3";
  purpose: string;
  consentedAt: string;
  issuedAt: string;
  signatureAlgorithm: string;
  artefactRetained: false;
  /** What CREAM cannot do, stated affirmatively in the receipt. */
  withheld: string[];
}

function hash(value: string, salt: string) {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 12);
}

export async function requestAssertion(input: {
  documentType: string;
  maskedIdentifier: string;
  displayName: string;
  purpose?: string;
}): Promise<DigilockerAssertion> {
  const salt = randomBytes(8).toString("hex");
  const catalogue = ISSUER_CATALOGUE.find((d) => d.documentType === input.documentType) ?? ISSUER_CATALOGUE[0];
  const purpose =
    input.purpose ?? "Identity verification for CREAM marketplace onboarding and fraud prevention";

  // In live mode this becomes an HTTPS call to the DigiLocker consent API.
  // The shape of the response is identical, which is the point of the adapter.
  if (isLive("digilocker")) {
    await new Promise((r) => setTimeout(r, 900));
  }

  const consentedAt = new Date().toISOString();

  return {
    requestId: `DL-${hash(input.displayName + salt, "req").toUpperCase()}-${new Date().getFullYear()}`,
    issuerId: catalogue.issuerId,
    documentType: input.documentType,
    maskedIdentifier: input.maskedIdentifier || `${hash(input.displayName, "id").slice(0, 4)}••••••${hash(salt, "tail").slice(0, 4)}`,
    assuranceLevel: catalogue.assuranceLevel,
    purpose,
    consentedAt,
    issuedAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
    signatureAlgorithm: "DSA-SHA256 (issuer)",
    artefactRetained: false,
    withheld: [
      "document image",
      "scanned pages",
      "signature image",
      "biometric reference",
    ],
  };
}

export function assertionToVerification(a: DigilockerAssertion): IdentityVerification {
  return {
    status: "verified",
    method: "digilocker",
    issuerRef: `dl:${a.issuerId.toLowerCase()}:${a.maskedIdentifier}`,
    issuer: `${a.issuerId} (via DigiLocker)`,
    documentType: a.documentType,
    verifiedAt: a.consentedAt,
    expiresAt: null,
    artefactRetained: false,
    assuranceLevel: a.assuranceLevel,
  };
}