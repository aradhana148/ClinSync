// Small local ordering shortcuts, not an automatic ICD-to-LOINC crosswalk.
// Each entry uses existing catalogue codes and requires doctor confirmation.
// ICD-10 labels: https://icd.who.int/browse10/2019/en
// Test references:
// https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis
// https://www.nhlbi.nih.gov/health/anemia/diagnosis
// https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid
// https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis
export const DIAGNOSIS_PANELS = [
  { code: 'E11', name: 'Type 2 diabetes mellitus', tests: ['GLU'] },
  { code: 'D64.9', name: 'Anaemia, unspecified', tests: ['CBC'] },
  { code: 'E03.9', name: 'Hypothyroidism, unspecified', tests: ['TSH'] },
  { code: 'E78.5', name: 'Hyperlipidaemia, unspecified', tests: ['LIPID'] },
] as const
