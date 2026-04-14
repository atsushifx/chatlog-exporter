/**
 * test-module.ts
 * モジュール名（スキル名）によるテスト絞り込みスクリプト
 *
 * 使用方法:
 *   deno task test:module <test-type> [module-name]
 *
 * 例:
 *   deno task test:module all
 *   deno task test:module unit
 *   deno task test:module unit classify-chatlog
 *   deno task test:module all classify-chatlog
 */

const VALID_MODULES = [
  'classify-chatlog',
  'export-chatlog',
  'filter-chatlog',
  'normalize-chatlog',
  'set-frontmatter',
] as const;

const VALID_TYPES = [
  'unit',
  'functional',
  'integration',
  'e2e',
  'system',
  'fixtures',
] as const;

// --allow-run が必要なテストタイプ
const TYPES_REQUIRING_RUN = new Set<string>(['system', 'fixtures']);

type ValidModule = typeof VALID_MODULES[number];
type ValidType = typeof VALID_TYPES[number];

function printUsage(): void {
  console.error('使用方法: deno task test:module <test-type> [module-name]');
  console.error('');
  console.error('テストタイプ (必須、all で全タイプ):');
  console.error('  all');
  VALID_TYPES.forEach((t) => console.error(`  ${t}`));
  console.error('');
  console.error('モジュール名 (省略時または all で全モジュール):');
  console.error('  all');
  VALID_MODULES.forEach((m) => console.error(`  ${m}`));
}

const args = Deno.args;

if (args.length === 0) {
  console.error('エラー: テストタイプを指定してください。');
  printUsage();
  Deno.exit(1);
}

const testType = args[0];
const moduleName = args[1] as ValidModule | undefined;

if (testType !== 'all' && !(VALID_TYPES as readonly string[]).includes(testType)) {
  console.error(`エラー: 不明なテストタイプ "${testType}"`);
  printUsage();
  Deno.exit(1);
}

if (moduleName !== undefined && moduleName !== 'all' && !(VALID_MODULES as readonly string[]).includes(moduleName)) {
  console.error(`エラー: 不明なモジュール名 "${moduleName}"`);
  printUsage();
  Deno.exit(1);
}

const targetTypes = (testType === 'all') ? [...VALID_TYPES] : [testType as ValidType];
const baseGlob = (moduleName === undefined || moduleName === 'all')
  ? '**/__tests__'
  : `**/${moduleName}/**/__tests__`;

const targetPaths = targetTypes.map((type) => `${baseGlob}/${type}/**/`);

const needsAllowRun = targetTypes.some((type) => TYPES_REQUIRING_RUN.has(type));

const denoTestArgs = [
  'test',
  '--allow-read',
  '--allow-write',
  ...(needsAllowRun ? ['--allow-run'] : []),
  ...targetPaths,
];

const command = new Deno.Command(Deno.execPath(), {
  args: denoTestArgs,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

const { code } = await command.output();
Deno.exit(code);
