/**
 * Empirical Verification Test Suite for File Vault Sharing & Plan Gating
 * Tests R1, R2, R3, R4, and R5 across PsicFlow App and Portal
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hasFeature, PLAN_FEATURES } from '../utils/planFeatures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    const errMsg = `  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`;
    failures.push(errMsg);
    console.error(errMsg);
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  const isEq = JSON.stringify(actual) === JSON.stringify(expected);
  assert(isEq, testName, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log('====================================================');
console.log('PSICFLOW FILE VAULT SHARING & PLAN GATING TEST SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST GROUP 1: Plan Feature Gating Logic
// ----------------------------------------------------
console.log('--- TEST GROUP 1: Plan Feature Gating for Portal ---');

assertEqual(hasFeature('Starter', 'portal'), false, 'Starter plan has portal = false');
assertEqual(hasFeature('Pro', 'portal'), false, 'Pro plan has portal = false');
assertEqual(hasFeature('Enterprise', 'portal'), true, 'Enterprise plan has portal = true');
assertEqual(hasFeature(undefined, 'portal'), false, 'undefined plan defaults to portal = false');
assertEqual(hasFeature('', 'portal'), false, 'empty string plan defaults to portal = false');
assertEqual(hasFeature('starter', 'portal'), false, 'Case-insensitive "starter" has portal = false');
assertEqual(hasFeature('pro', 'portal'), false, 'Case-insensitive "pro" has portal = false');
assertEqual(hasFeature('enterprise', 'portal'), true, 'Case-insensitive "enterprise" has portal = true');

assertEqual(PLAN_FEATURES.Starter.portal, false, 'PLAN_FEATURES.Starter.portal is explicitly false');
assertEqual(PLAN_FEATURES.Pro.portal, false, 'PLAN_FEATURES.Pro.portal is explicitly false');
assertEqual(PLAN_FEATURES.Enterprise.portal, true, 'PLAN_FEATURES.Enterprise.portal is explicitly true');

// ----------------------------------------------------
// TEST GROUP 2: Zero Emoji Audit across Files
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: Zero Emoji Compliance Audit ---');

const filesToCheck = [
  path.resolve(__dirname, '../pages/pacientes/[id].tsx'),
  path.resolve(__dirname, '../pages/biblioteca.tsx'),
  path.resolve(__dirname, '../../../portal/src/pages/recursos.tsx'),
  path.resolve(__dirname, '../../../portal/src/pages/index.tsx'),
  path.resolve(__dirname, '../../../../supabase/migrations/20260818030000_add_is_shared_to_files_vault.sql')
];

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F1E0}-\u{1F1FF}\u{1FA00}-\u{1FAFF}]/u;

filesToCheck.forEach(filePath => {
  const fileName = path.basename(filePath);
  assert(fs.existsSync(filePath), `File exists: ${fileName}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let emojiCount = 0;
  lines.forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      emojiCount++;
      console.error(`Emoji in ${fileName}:${idx + 1}: ${line}`);
    }
  });
  assertEqual(emojiCount, 0, `ZERO emojis in ${fileName}`);
});

// ----------------------------------------------------
// TEST GROUP 3: Patient Details Contract Audit (pacientes/[id].tsx)
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: Patient Details (pacientes/[id].tsx) ---');

const patientDetailCode = fs.readFileSync(path.resolve(__dirname, '../pages/pacientes/[id].tsx'), 'utf8');

assert(patientDetailCode.includes('hasFeature'), 'Imports or uses hasFeature for plan checks');
assert(patientDetailCode.includes('canShareWithPatient'), 'Computes canShareWithPatient capability');
assert(patientDetailCode.includes('shareWithPatient'), 'Manages shareWithPatient state for upload');
assert(patientDetailCode.includes('Compartir con el paciente en su Portal'), 'R2: Includes "Compartir con el paciente en su Portal" checkbox label');
assert(patientDetailCode.includes('Eye'), 'R2: Uses Lucide Eye icon');
assert(patientDetailCode.includes('EyeOff'), 'R2: Uses Lucide EyeOff icon');
assert(patientDetailCode.includes('handleToggleFileShare'), 'R2: Supports dynamic toggling of is_shared');
assert(patientDetailCode.includes("from('files_vault')") && patientDetailCode.includes("update({ is_shared: nextShared })"), 'R2: Updates is_shared in files_vault table on toggle');
assert(patientDetailCode.includes("router.push('/plan')"), 'R4: Redirects to /plan when plan lacks portal feature');
assert(patientDetailCode.includes('Plan Enterprise'), 'R4: Displays Plan Enterprise premium badge');
assert(patientDetailCode.includes('is_shared: canShareWithPatient ? shareWithPatient : false'), 'R2/R4: Inserts is_shared respecting plan gating in DB');

// ----------------------------------------------------
// TEST GROUP 4: Biblioteca Contract Audit (biblioteca.tsx)
// ----------------------------------------------------
console.log('\n--- TEST GROUP 4: Biblioteca (biblioteca.tsx) ---');

const bibliotecaCode = fs.readFileSync(path.resolve(__dirname, '../pages/biblioteca.tsx'), 'utf8');

assert(bibliotecaCode.includes('hasFeature'), 'Imports hasFeature helper');
assert(bibliotecaCode.includes('canShareWithPatient'), 'Computes canShareWithPatient capability');
assert(bibliotecaCode.includes('selectedPatientId'), 'R3: Manages patient selector state');
assert(bibliotecaCode.includes('Asignar a Paciente'), 'R3: Includes patient selector label in upload modal');
assert(bibliotecaCode.includes('fetchPatientResources'), 'R3: Fetches resources assigned to patients');
assert(bibliotecaCode.includes("is('patient_id', null)"), 'R3: Filters main/global library list with patient_id IS NULL');
assert(bibliotecaCode.includes("not('patient_id', 'is', null)"), 'R3: Filters patient-assigned list with patient_id NOT NULL');
assert(bibliotecaCode.includes("activeTab === 'global'"), 'R3: Has Recursos Globales tab');
assert(bibliotecaCode.includes("activeTab === 'pacientes'"), 'R3: Has Asignados a Pacientes tab');
assert(bibliotecaCode.includes('is_shared: true'), 'R3: Sets is_shared = true on uploads');
assert(bibliotecaCode.includes("router.push('/plan')"), 'R4: Redirects to /plan when attempting gated features');
assert(bibliotecaCode.includes('Plan Enterprise'), 'R4: Displays Plan Enterprise badge on locked patient selector');

// ----------------------------------------------------
// TEST GROUP 5: Patient Portal Alignment Audit (recursos.tsx & index.tsx)
// ----------------------------------------------------
console.log('\n--- TEST GROUP 5: Patient Portal Alignment ---');

const portalRecursosCode = fs.readFileSync(path.resolve(__dirname, '../../../portal/src/pages/recursos.tsx'), 'utf8');
const portalIndexCode = fs.readFileSync(path.resolve(__dirname, '../../../portal/src/pages/index.tsx'), 'utf8');

assert(portalRecursosCode.includes(".eq('is_shared', true)"), "R5: portal recursos.tsx enforces .eq('is_shared', true)");
assert(portalRecursosCode.includes("or(`patient_id.eq.${patData.id},patient_id.is.null`)"), 'R5: portal recursos.tsx filters for patient_id OR null');
assert(portalIndexCode.includes(".eq('is_shared', true)"), "R5: portal index.tsx dashboard enforces .eq('is_shared', true)");

// ----------------------------------------------------
// TEST GROUP 6: Database Migration Script Audit
// ----------------------------------------------------
console.log('\n--- TEST GROUP 6: Database Migration Script ---');

const migrationCode = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260818030000_add_is_shared_to_files_vault.sql'), 'utf8');

assert(migrationCode.includes('ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE'), 'R1: Adds is_shared column with default false');
assert(migrationCode.includes('UPDATE public.files_vault') && migrationCode.includes('SET is_shared = TRUE') && migrationCode.includes('WHERE patient_id IS NULL'), 'R1: Updates existing global files (patient_id IS NULL) to is_shared = true');
assert(migrationCode.includes('CREATE POLICY patient_files_select ON public.files_vault'), 'R1: Updates RLS policy patient_files_select');
assert(migrationCode.includes('is_shared = TRUE'), 'R1: RLS policy enforces is_shared = TRUE');
assert(migrationCode.includes('CREATE INDEX IF NOT EXISTS idx_files_vault_is_shared'), 'R1: Creates index on is_shared');

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  console.error('\nFailures:\n' + failures.join('\n'));
  process.exit(1);
} else {
  console.log('\nALL TESTS PASSED SUCCESSFULLY (100% PASS RATE).');
  process.exit(0);
}
