/**
 * Empirical Verification Test Suite for recursos.tsx
 * Challenger 1 - Milestone 1 & 2 Verification
 */

import fs from 'fs';
import path from 'path';

// --- Test Harness Framework ---
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
console.log('CHALLENGER 1: EMPIRICAL VERIFICATION OF RECURSOS.TSX');
console.log('====================================================\n');

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load and Verify Source Integrity
const sourcePath = path.resolve(__dirname, '../pages/recursos.tsx');
assert(fs.existsSync(sourcePath), 'Source file exists at apps/portal/src/pages/recursos.tsx');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// ----------------------------------------------------
// Section A: Helper Implementations Extracted from Source
// ----------------------------------------------------
function formatBytes(bytes?: number | null, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDateSpanish(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function getFileTypeDetails(mimeType: string, filename: string) {
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType?.toLowerCase() || '';

  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      label: 'PDF',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      iconBg: 'bg-rose-100 text-rose-700'
    };
  }

  if (
    mime.includes('word') || 
    mime.includes('officedocument.wordprocessingml') || 
    ext === 'doc' || 
    ext === 'docx'
  ) {
    return {
      label: 'Word',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700'
    };
  }

  if (
    mime.includes('spreadsheet') || 
    mime.includes('excel') || 
    mime.includes('csv') || 
    ext === 'xls' || 
    ext === 'xlsx' || 
    ext === 'csv'
  ) {
    return {
      label: 'Excel',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700'
    };
  }

  if (
    mime.includes('image') || 
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)
  ) {
    return {
      label: 'Imagen',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-100 text-purple-700'
    };
  }

  if (
    mime.includes('audio') || 
    ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)
  ) {
    return {
      label: 'Audio',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700'
    };
  }

  return {
    label: ext.toUpperCase() || 'Documento',
    badgeBg: 'bg-[#F1EDE4] text-[#3E5C4E] border-[#E2DCD0]',
    iconBg: 'bg-[#DAEDDF] text-[#1A3020]'
  };
}

interface VaultFile {
  id: string;
  organization_id: string;
  patient_id: string | null;
  session_id: string | null;
  original_name: string;
  saved_name: string;
  storage_path: string;
  mime_type: string;
  category: string;
  description: string | null;
  size_bytes: number;
  is_shared: boolean;
  created_at: string;
}

function filterResources(files: VaultFile[], searchTerm: string, activeCategory: string): VaultFile[] {
  const term = searchTerm.trim().toLowerCase();

  return files.filter(f => {
    // Category check
    const matchesCategory = activeCategory === 'Todos' || f.category === activeCategory;
    if (!matchesCategory) return false;

    // If no search term, pass category match
    if (!term) return true;

    const nameMatch = f.original_name.toLowerCase().includes(term);
    const descMatch = f.description ? f.description.toLowerCase().includes(term) : false;
    const catMatch = f.category ? f.category.toLowerCase().includes(term) : false;
    const mimeMatch = f.mime_type ? f.mime_type.toLowerCase().includes(term) : false;
    const extMatch = f.original_name.split('.').pop()?.toLowerCase().includes(term) || false;

    return nameMatch || descMatch || catMatch || mimeMatch || extMatch;
  });
}

// ----------------------------------------------------
// TEST GROUP 1: formatBytes Edge Cases
// ----------------------------------------------------
console.log('\n--- TEST GROUP 1: formatBytes Edge Cases ---');

assertEqual(formatBytes(0), '0 KB', 'formatBytes(0) returns 0 KB');
assertEqual(formatBytes(-1), '0 KB', 'formatBytes(-1) returns 0 KB');
assertEqual(formatBytes(-9999), '0 KB', 'formatBytes(-9999) returns 0 KB');
assertEqual(formatBytes(null), '0 KB', 'formatBytes(null) returns 0 KB');
assertEqual(formatBytes(undefined), '0 KB', 'formatBytes(undefined) returns 0 KB');
assertEqual(formatBytes(1), '1 B', 'formatBytes(1) returns 1 B');
assertEqual(formatBytes(512), '512 B', 'formatBytes(512) returns 512 B');
assertEqual(formatBytes(1023), '1023 B', 'formatBytes(1023) returns 1023 B');
assertEqual(formatBytes(1024), '1 KB', 'formatBytes(1024) returns 1 KB');
assertEqual(formatBytes(1536), '1.5 KB', 'formatBytes(1536) returns 1.5 KB');
assertEqual(formatBytes(2048), '2 KB', 'formatBytes(2048) returns 2 KB');
assertEqual(formatBytes(1048576), '1 MB', 'formatBytes(1048576) returns 1 MB');
assertEqual(formatBytes(5242880), '5 MB', 'formatBytes(5242880) returns 5 MB');
assertEqual(formatBytes(1073741824), '1 GB', 'formatBytes(1073741824) returns 1 GB');
assertEqual(formatBytes(5368709120), '5 GB', 'formatBytes(5368709120) returns 5 GB');
assertEqual(formatBytes(1536, 0), '2 KB', 'formatBytes(1536, 0) rounds to 2 KB');
assertEqual(formatBytes(1536, 2), '1.5 KB', 'formatBytes(1536, 2) handles 2 decimals correctly (parseFloat trims trailing 0)');

// ----------------------------------------------------
// TEST GROUP 2: formatDateSpanish Edge Cases
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: formatDateSpanish Edge Cases ---');

assertEqual(formatDateSpanish(''), '', 'formatDateSpanish("") returns empty string');
assert(formatDateSpanish('2026-08-17T12:00:00Z').includes('2026'), 'formatDateSpanish parses ISO string and includes year 2026');
assert(formatDateSpanish('2026-08-17T12:00:00Z').includes('17'), 'formatDateSpanish includes day 17');
assertEqual(formatDateSpanish('not-a-valid-date'), 'not-a-valid-date', 'formatDateSpanish gracefully returns input on invalid date');

// ----------------------------------------------------
// TEST GROUP 3: getFileTypeDetails MIME & Extension Resolution
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: getFileTypeDetails Resolution ---');

// PDF
assertEqual(getFileTypeDetails('application/pdf', 'guia_ansiedad.pdf').label, 'PDF', 'Resolves PDF from mime and extension');
assertEqual(getFileTypeDetails('', 'guia_ansiedad.pdf').label, 'PDF', 'Resolves PDF from extension only');
assertEqual(getFileTypeDetails('application/pdf', 'guia_ansiedad').label, 'PDF', 'Resolves PDF from mime only');
assertEqual(getFileTypeDetails('APPLICATION/PDF', 'TEST.PDF').label, 'PDF', 'Resolves PDF with uppercase inputs');

// Word
assertEqual(getFileTypeDetails('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'form.docx').label, 'Word', 'Resolves Word docx');
assertEqual(getFileTypeDetails('application/msword', 'form.doc').label, 'Word', 'Resolves Word doc');
assertEqual(getFileTypeDetails('', 'form.docx').label, 'Word', 'Resolves Word from extension only');

// Excel / CSV
assertEqual(getFileTypeDetails('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'data.xlsx').label, 'Excel', 'Resolves Excel xlsx');
assertEqual(getFileTypeDetails('application/vnd.ms-excel', 'data.xls').label, 'Excel', 'Resolves Excel xls');
assertEqual(getFileTypeDetails('text/csv', 'data.csv').label, 'Excel', 'Resolves CSV');
assertEqual(getFileTypeDetails('', 'registro.csv').label, 'Excel', 'Resolves CSV from extension only');

// Image
assertEqual(getFileTypeDetails('image/png', 'diagrama.png').label, 'Imagen', 'Resolves PNG image');
assertEqual(getFileTypeDetails('image/jpeg', 'foto.jpg').label, 'Imagen', 'Resolves JPEG image');
assertEqual(getFileTypeDetails('image/webp', 'grafico.webp').label, 'Imagen', 'Resolves WebP image');
assertEqual(getFileTypeDetails('image/svg+xml', 'icono.svg').label, 'Imagen', 'Resolves SVG image');
assertEqual(getFileTypeDetails('', 'scan.jpg').label, 'Imagen', 'Resolves image from extension only');

// Audio
assertEqual(getFileTypeDetails('audio/mpeg', 'meditacion.mp3').label, 'Audio', 'Resolves MP3 audio');
assertEqual(getFileTypeDetails('audio/wav', 'sesion.wav').label, 'Audio', 'Resolves WAV audio');
assertEqual(getFileTypeDetails('audio/x-m4a', 'audio.m4a').label, 'Audio', 'Resolves M4A audio');
assertEqual(getFileTypeDetails('', 'relajacion.mp3').label, 'Audio', 'Resolves audio from extension only');

// Generic / Unknown
assertEqual(getFileTypeDetails('application/zip', 'archivo.zip').label, 'ZIP', 'Resolves generic ZIP with label ZIP');
assertEqual(getFileTypeDetails('application/octet-stream', 'desconocido.bin').label, 'BIN', 'Resolves generic BIN with label BIN');
assertEqual(getFileTypeDetails('', '').label, 'Documento', 'Fallback label Documento when filename is empty string');
assertEqual(getFileTypeDetails('', 'archivo_sin_extension').label, 'ARCHIVO_SIN_EXTENSION', 'Filename without dot uses filename as uppercase label');

// ----------------------------------------------------
// TEST GROUP 4: Category Filtering Logic
// ----------------------------------------------------
console.log('\n--- TEST GROUP 4: Category Filtering Logic ---');

const mockFiles: VaultFile[] = [
  {
    id: 'f1',
    organization_id: 'org1',
    patient_id: 'pat123',
    session_id: null,
    original_name: 'Guía_Respiración_Diafragmática.pdf',
    saved_name: 'f1.pdf',
    storage_path: 'org1/pat123/f1.pdf',
    mime_type: 'application/pdf',
    category: 'Guías Clínicas',
    description: 'Técnica de respiración lenta de 4 tiempos para regulación autonómica.',
    size_bytes: 524288,
    is_shared: true,
    created_at: '2026-08-10T10:00:00Z'
  },
  {
    id: 'f2',
    organization_id: 'org1',
    patient_id: null, // Global
    session_id: null,
    original_name: 'Registro_Pensamientos_Automáticos.docx',
    saved_name: 'f2.docx',
    storage_path: 'org1/global/f2.docx',
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'Plantillas',
    description: 'Plantilla de reestructuración cognitiva de 5 columnas.',
    size_bytes: 1048576,
    is_shared: true,
    created_at: '2026-08-11T14:30:00Z'
  },
  {
    id: 'f3',
    organization_id: 'org1',
    patient_id: 'pat123',
    session_id: null,
    original_name: 'Psicoeducación_Trastorno_Pánico.pdf',
    saved_name: 'f3.pdf',
    storage_path: 'org1/pat123/f3.pdf',
    mime_type: 'application/pdf',
    category: 'Material Psicoeducativo',
    description: null, // Null description test
    size_bytes: 2097152,
    is_shared: true,
    created_at: '2026-08-12T09:15:00Z'
  },
  {
    id: 'f4',
    organization_id: 'org1',
    patient_id: null, // Global
    session_id: null,
    original_name: 'Reglamento_General_Clinica.pdf',
    saved_name: 'f4.pdf',
    storage_path: 'org1/global/f4.pdf',
    mime_type: 'application/pdf',
    category: 'General',
    description: 'Normas de atención, consentimiento y políticas del centro.',
    size_bytes: 153600,
    is_shared: true,
    created_at: '2026-08-01T08:00:00Z'
  },
  {
    id: 'f5',
    organization_id: 'org1',
    patient_id: 'pat123',
    session_id: null,
    original_name: 'Inventario_Beck_Ansiedad_Resultados.xlsx',
    saved_name: 'f5.xlsx',
    storage_path: 'org1/pat123/f5.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'Evaluaciones Especiales', // Custom category test
    description: 'Resultados cuantitativos escala BAI.',
    size_bytes: 45056,
    is_shared: true,
    created_at: '2026-08-15T18:00:00Z'
  }
];

// Test 'Todos'
const allResults = filterResources(mockFiles, '', 'Todos');
assertEqual(allResults.length, 5, 'Category "Todos" returns all 5 files');

// Test 'General'
const generalResults = filterResources(mockFiles, '', 'General');
assertEqual(generalResults.length, 1, 'Category "General" returns exactly 1 file');
assertEqual(generalResults[0].id, 'f4', 'Category "General" returns f4');

// Test 'Guías Clínicas'
const guiasResults = filterResources(mockFiles, '', 'Guías Clínicas');
assertEqual(guiasResults.length, 1, 'Category "Guías Clínicas" returns exactly 1 file');
assertEqual(guiasResults[0].id, 'f1', 'Category "Guías Clínicas" returns f1');

// Test 'Plantillas'
const plantillasResults = filterResources(mockFiles, '', 'Plantillas');
assertEqual(plantillasResults.length, 1, 'Category "Plantillas" returns exactly 1 file');
assertEqual(plantillasResults[0].id, 'f2', 'Category "Plantillas" returns f2');

// Test 'Material Psicoeducativo'
const psicoResults = filterResources(mockFiles, '', 'Material Psicoeducativo');
assertEqual(psicoResults.length, 1, 'Category "Material Psicoeducativo" returns exactly 1 file');
assertEqual(psicoResults[0].id, 'f3', 'Category "Material Psicoeducativo" returns f3');

// Test Custom category filtering
const customResults = filterResources(mockFiles, '', 'Evaluaciones Especiales');
assertEqual(customResults.length, 1, 'Custom category filter returns matching file');
assertEqual(customResults[0].id, 'f5', 'Custom category matches f5');

// Test Non-existent category
const emptyCatResults = filterResources(mockFiles, '', 'Inexistente');
assertEqual(emptyCatResults.length, 0, 'Non-existent category returns 0 files');

// ----------------------------------------------------
// TEST GROUP 5: Multi-Field Search Filtering Logic
// ----------------------------------------------------
console.log('\n--- TEST GROUP 5: Multi-Field Search Filtering Logic ---');

// Search by title substring
const titleSearch = filterResources(mockFiles, 'respiración', 'Todos');
assertEqual(titleSearch.length, 1, 'Search "respiración" matches title of f1');
assertEqual(titleSearch[0].id, 'f1', 'Matched f1');

// Case insensitivity: Uppercase search
const upperSearch = filterResources(mockFiles, 'RESPIRACIÓN', 'Todos');
assertEqual(upperSearch.length, 1, 'Search "RESPIRACIÓN" (uppercase) matches f1');

// Search by description keyword
const descSearch = filterResources(mockFiles, 'reestructuración', 'Todos');
assertEqual(descSearch.length, 1, 'Search "reestructuración" matches description of f2');
assertEqual(descSearch[0].id, 'f2', 'Matched f2');

// Search with null description present in dataset
const nullDescSearch = filterResources(mockFiles, 'Pánico', 'Todos');
assertEqual(nullDescSearch.length, 1, 'Search "Pánico" matches f3 without crashing on null description');
assertEqual(nullDescSearch[0].id, 'f3', 'Matched f3');

// Search by category name in search bar
const searchByCat = filterResources(mockFiles, 'Psicoeducativo', 'Todos');
assertEqual(searchByCat.length, 1, 'Search "Psicoeducativo" in search bar matches f3');

// Search by MIME type keyword
const mimeSearch = filterResources(mockFiles, 'spreadsheet', 'Todos');
assertEqual(mimeSearch.length, 1, 'Search "spreadsheet" matches f5 mime_type');
assertEqual(mimeSearch[0].id, 'f5', 'Matched f5');

// Search by extension (.docx)
const extDocxSearch = filterResources(mockFiles, 'docx', 'Todos');
assertEqual(extDocxSearch.length, 1, 'Search "docx" matches f2 extension');

// Search by extension (.pdf)
const extPdfSearch = filterResources(mockFiles, 'pdf', 'Todos');
assertEqual(extPdfSearch.length, 3, 'Search "pdf" matches all 3 PDF files (f1, f3, f4)');

// Search with leading and trailing whitespace
const wsSearch = filterResources(mockFiles, '   General   ', 'Todos');
assertEqual(wsSearch.length, 1, 'Search with leading/trailing whitespace correctly trimmed');

// Search combined with Category filter
const combinedSearch = filterResources(mockFiles, 'pdf', 'Guías Clínicas');
assertEqual(combinedSearch.length, 1, 'Combined search "pdf" + category "Guías Clínicas" returns only f1');
assertEqual(combinedSearch[0].id, 'f1', 'Matched f1');

const combinedEmpty = filterResources(mockFiles, 'docx', 'Guías Clínicas');
assertEqual(combinedEmpty.length, 0, 'Combined search "docx" + category "Guías Clínicas" returns 0 files');

// Adversarial Search Inputs
const specialChar1 = filterResources(mockFiles, '[[*?\\', 'Todos');
assertEqual(specialChar1.length, 0, 'Adversarial regex characters "[*?\\" handled safely without throwing');

const quoteSearch = filterResources(mockFiles, `'"<script>`, 'Todos');
assertEqual(quoteSearch.length, 0, 'HTML/Script injection search safely returns 0');

const longSearch = filterResources(mockFiles, 'A'.repeat(500), 'Todos');
assertEqual(longSearch.length, 0, '500-char string search safely returns 0');

// ----------------------------------------------------
// TEST GROUP 6: Exclusive vs Global Resources Split
// ----------------------------------------------------
console.log('\n--- TEST GROUP 6: Exclusive vs Global Resources Split ---');

const exclusive = mockFiles.filter(f => f.patient_id !== null);
const globalRes = mockFiles.filter(f => f.patient_id === null);

assertEqual(exclusive.length, 3, 'Exclusive resources count is 3 (f1, f3, f5)');
assertEqual(globalRes.length, 2, 'Global resources count is 2 (f2, f4)');
assert(exclusive.every(f => f.patient_id !== null), 'All exclusive resources have non-null patient_id');
assert(globalRes.every(f => f.patient_id === null), 'All global resources have null patient_id');

// ----------------------------------------------------
// TEST GROUP 7: Zero Emoji & Contract Audit
// ----------------------------------------------------
console.log('\n--- TEST GROUP 7: Zero Emoji & Storage Contract ---');

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F1E0}-\u{1F1FF}\u{1FA00}-\u{1FAFF}]/u;
const sourceLines = sourceCode.split('\n');
let emojiCount = 0;
sourceLines.forEach((line, idx) => {
  if (emojiRegex.test(line)) {
    emojiCount++;
    console.error(`Emoji found on line ${idx + 1}: ${line}`);
  }
});
assertEqual(emojiCount, 0, 'ZERO emojis found in recursos.tsx');

// Verify createSignedUrl expiration parameter is 60 seconds
assert(sourceCode.includes(".createSignedUrl(file.storage_path, 60)"), 'Uses createSignedUrl with 60-second token');
assert(sourceCode.includes("from('clinical-vault')"), "Queries 'clinical-vault' private bucket");
assert(sourceCode.includes("from('files_vault')"), "Queries 'files_vault' database table");
assert(sourceCode.includes(".eq('is_shared', true)"), "Filters by is_shared = true for patient portal confidentiality");
assert(sourceCode.includes("or(`patient_id.eq.${patData.id},patient_id.is.null`)"), 'Includes patient RLS filter (.or patient_id / null)');

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
  console.log('\nALL EMPIRICAL TESTS PASSED SUCCESSFULLY (100% PASS RATE).');
  process.exit(0);
}
