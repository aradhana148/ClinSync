// Order-catalogue references, verified against the official LOINC term pages.
// These identify the named test/panel, not individual analyser result fields.
// The current analyser produces abbreviated panels, not full LOINC panel payloads.
export const TEST_LOINC: Record<string, string> = {
  CBC: '58410-2', // https://loinc.org/58410-2/ — automated CBC panel
  GLU: '1558-6', // https://loinc.org/1558-6/ — fasting serum/plasma glucose
  LIPID: '24331-1', // https://loinc.org/24331-1/ — lipid panel
  LFT: '24325-3', // https://loinc.org/24325-3/ — hepatic function panel
  KFT: '24362-6', // https://loinc.org/24362-6/ — renal function panel
  TSH: '3016-3', // https://loinc.org/3016-3/ — thyrotropin
  UA: '24356-8', // https://loinc.org/24356-8/ — urinalysis panel
}
