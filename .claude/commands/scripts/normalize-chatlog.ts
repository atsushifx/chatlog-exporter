// src: scripts/normalize-chatlog.ts
// @(#): Utilities for normalizing chatlog processing
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
// normalize_chatlog.ts — Utilities for normalizing chatlog processing

// ─── Types ────────────────────────────────────────────────────────────────────

/** Structured result of {@link parseArgs}. */
export type ParsedArgs = {
  dir?: string;
  agent?: string;
  yearMonth?: string;
  dryRun: boolean;
  concurrency: number;
  output?: string;
};

/** A single topic segment extracted from a chatlog by {@link segmentChatlog}. */
export type Segment = {
  title: string;
  summary: string;
  body: string;
};

/** Counters for {@link writeOutput} results across a batch run. */
export type Stats = {
  success: number;
  skip: number;
  fail: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default maximum number of concurrent tasks for {@link parseArgs}. */
const DEFAULT_CONCURRENCY = 4;

/** Maximum number of segments returned by {@link segmentChatlog}. */
const MAX_SEGMENTS = 10;

/** Model IDs and aliases accepted by the Claude Code CLI. */
const VALID_MODELS = new Set([
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'opus',
  'sonnet',
  'haiku',
]);

// ─── YAML Utilities ───────────────────────────────────────────────────────────

/**
 * Cleans a raw YAML string by removing code fence lines and non-YAML preamble.
 *
 * @param raw - The raw string, possibly wrapped in ```yaml...``` fences
 * @param firstField - The first expected YAML field name (e.g. "title")
 * @returns The cleaned, trimmed YAML string
 */
export function cleanYaml(raw: string, firstField: string): string {
  if (raw === '') { return ''; }

  const lines = raw.split('\n');

  // Remove code fence delimiter lines (``` markers)
  const stripped = lines.filter((line) => !line.startsWith('```'));

  // Drop any preamble before the first expected YAML field
  const firstIndex = stripped.findIndex((line) => line.startsWith(`${firstField}:`));
  const yamlLines = firstIndex >= 0 ? stripped.slice(firstIndex) : stripped;

  return yamlLines.join('\n').trim();
}

/**
 * Parses a YAML frontmatter block from a Markdown text string.
 *
 * @param text - The full Markdown text, optionally starting with a `---` frontmatter block
 * @returns An object with `meta` (key-value pairs from frontmatter) and `fullBody` (text after frontmatter)
 */
export function parseFrontmatter(text: string): { meta: Record<string, string>; fullBody: string } {
  const DELIMITER = '---';

  // Must start with `---\n` (or `---` at start); otherwise no frontmatter
  if (!text.startsWith(DELIMITER + '\n')) {
    return { meta: {}, fullBody: text };
  }

  // Find the closing `---` delimiter (after the opening line)
  const afterOpen = text.indexOf('\n') + 1; // position after first `---\n`
  const closeIndex = text.indexOf('\n' + DELIMITER, afterOpen);

  // No closing delimiter found — treat as invalid frontmatter
  if (closeIndex === -1) {
    return { meta: {}, fullBody: text };
  }

  const frontmatterBlock = text.slice(afterOpen, closeIndex);
  const fullBody = text.slice(closeIndex + 1 + DELIMITER.length);

  const meta: Record<string, string> = {};
  for (const line of frontmatterBlock.split('\n')) {
    const colonPos = line.indexOf(':');
    if (colonPos === -1) { continue; }
    const key = line.slice(0, colonPos).trim();
    const value = line.slice(colonPos + 1).trim();
    if (key) { meta[key] = value; }
  }

  return { meta, fullBody };
}

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Extracts the base name (without extension and trailing hash) from a file path.
 * Extracts the base name (without extension and trailing hash) from a file path.
 *
 * Strips the directory, `.md` extension, and any trailing `-<7hex>` hash suffix.
 * For example: `path/to/2026-03-11-1-api-a4a84394.md` → `2026-03-11-1-api-a4a84394`
 * (hash removal is intentional only when hash matches `-[0-9a-f]{7}$` pattern)
 *
 * @param filePath - Path to the source chatlog file
 * @returns Base name without extension and without trailing `-XXXXXXX` hash segment
 */
export function extractBaseName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? filePath;
  const withoutExt = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
  // Remove trailing -<7hex> hash if present
  return withoutExt.replace(/-[0-9a-f]{7}$/, '');
}

/**
 * Generates an output file name for a segment.
 *
 * Format: `<baseName>-<XX>-<hash7>.md`
 * - baseName: source file name without extension and without trailing hash
 * - XX: zero-padded two-digit sequential index (01-based)
 * - hash7: first 7 hex chars of SHA-256( `${baseName}-${XX}` + `-` + timestamp12 + `-` + random8 )
 *   where timestamp12 is YYYYMMDDHHmmss (14 chars... wait: 12 digits = YYYYMMDDHHmm)
 *   and random8 is 8 random alphanumeric characters
 *
 * @param filePath - Path to the source chatlog file
 * @param index    - Zero-based segment index (displayed as 1-based two-digit number)
 * @returns Promise resolving to the output file name (including `.md` extension)
 * Strips the directory, `.md` extension, and any trailing `-<7hex>` hash suffix.
 * For example: `path/to/2026-03-11-1-api-a4a84394.md` → `2026-03-11-1-api-a4a84394`
 * (hash removal is intentional only when hash matches `-[0-9a-f]{7}$` pattern)
 *
 * @param filePath - Path to the source chatlog file
 * @returns Base name without extension and without trailing `-XXXXXXX` hash segment
 */
export function extractBaseName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? filePath;
  const withoutExt = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
  // Remove trailing -<7hex> hash if present
  return withoutExt.replace(/-[0-9a-f]{7}$/, '');
}

/**
 * Generates an output file name for a segment.
 *
 * Format: `<baseName>-<XX>-<hash7>.md`
 * - baseName: source file name without extension and without trailing hash
 * - XX: zero-padded two-digit sequential index (01-based)
 * - hash7: first 7 hex chars of SHA-256( `${baseName}-${XX}` + `-` + timestamp12 + `-` + random8 )
 *   where timestamp12 is YYYYMMDDHHmmss (14 chars... wait: 12 digits = YYYYMMDDHHmm)
 *   and random8 is 8 random alphanumeric characters
 *
 * @param filePath - Path to the source chatlog file
 * @param index    - Zero-based segment index (displayed as 1-based two-digit number)
 * @returns Promise resolving to the output file name (including `.md` extension)
 */
export async function generateLogId(
  filePath: string,
  agentName: string,
  title: string,
  index: number,
): Promise<string> {
  // Extract date from path: first YYYY-MM occurrence → YYYYMM01
  const dateMatch = filePath.match(/(\d{4})-(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}${dateMatch[2]}01` : '00000000';

  // Build slug: lowercase, replace non-alphanumeric runs with hyphens, strip edge hyphens
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Compute hash: SHA-256 of concatenated inputs, take first 7 hex chars
  const raw = filePath + agentName + title + String(index);
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash7 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 7);

  return `${date}-${agentName}-${slug}-${hash7}`;
}

// ─── JSON Parsing ─────────────────────────────────────────────────────────────

/**
 * Attempts to parse a JSON array from a raw string using a 3-pass fallback strategy.
 *
 * Pass 1 — Direct parse: if `raw.trimStart()` starts with `[`, try `JSON.parse(raw)`.
 * Pass 2 — Non-greedy match: use `/\[.*?\]/s` to extract the shortest `[...]` substring.
 * Pass 3 — Greedy match: use `/\[.*\]/s` to extract the longest `[...]` substring.
 *
 * Each `JSON.parse` call is wrapped in try/catch. Returns `null` if all passes fail.
 *
 * @param raw - Raw string that may contain a JSON array
 * @returns Parsed array or `null`
 */
export function parseJsonArray(raw: string): unknown[] | null {
  // Pass 1 — Direct parse
  if (raw.trimStart().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { return parsed; }
    } catch {
      // fall through to next pass
    }
  }

  // Pass 2 — Non-greedy match
  const nonGreedyMatch = raw.match(/\[.*?\]/s);
  if (nonGreedyMatch) {
    try {
      const parsed = JSON.parse(nonGreedyMatch[0]);
      if (Array.isArray(parsed)) { return parsed; }
    } catch {
      // fall through to next pass
    }
  }

  // Pass 3 — Greedy match
  const greedyMatch = raw.match(/\[.*\]/s);
  if (greedyMatch) {
    try {
      const parsed = JSON.parse(greedyMatch[0]);
      if (Array.isArray(parsed)) { return parsed; }
    } catch {
      // fall through
    }
  }

  return null;
}

// ─── Segment File Generation ──────────────────────────────────────────────────

/**
 * Generates a Markdown string from a {@link Segment} object.
 *
 * Output structure:
 * ```markdown
 * ## Summary
 * {segment.summary}
 *
 * ## Excerpt
 * {segment.body}
 * ```
 *
 * Both section headings (`## Summary` and `## Excerpt`) are always emitted,
 * even when `summary` or `body` are empty strings.
 *
 * @param segment - The segment to render
 * @returns Markdown string containing the Summary and Excerpt sections
 */
export function generateSegmentFile(segment: Segment): string {
  return `## Summary\n${segment.summary}\n\n## Excerpt\n${segment.body}`;
}

/**
 * Attaches a YAML frontmatter block to the given Markdown content.
 *
 * Merges fields from `sourceMeta` (propagated from the source file's frontmatter)
 * with AI-generated fields in `segmentMeta`, then prepends the resulting
 * `---\n...\n---\n` block to `content`.
 *
 * @param content - The Markdown body to attach frontmatter to
 * @param sourceMeta - Fields propagated from the source file (e.g. `project`)
 * @param segmentMeta - AI-generated fields (`title`, `log_id`, `summary`)
 * @returns Markdown string with frontmatter prepended
 */
export function attachFrontmatter(
  content: string,
  sourceMeta: Record<string, string>,
  segmentMeta: { title: string; log_id: string; summary: string },
): string {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(sourceMeta)) {
    fields.push(`${key}: ${value}`);
  }
  fields.push(`title: ${segmentMeta.title}`);
  fields.push(`log_id: ${segmentMeta.log_id}`);
  fields.push(`summary: ${segmentMeta.summary}`);
  return `---\n${fields.join('\n')}\n---\n${content}`;
}

// ─── AI Execution ─────────────────────────────────────────────────────────────

/**
 * Runs the Claude CLI with the given model, system and user prompts.
 *
 * @param model - The model ID or alias to use (e.g. "claude-sonnet-4-6" or "sonnet")
 * @param systemPrompt - The system prompt passed via `-p` argument
 * @param userPrompt - The user prompt written to stdin
 * @returns Promise resolving to the trimmed stdout text from Claude CLI
 * @throws Error if `model` is not a recognized Claude Code model ID or alias
 * @throws Error if Claude CLI exits with a non-zero code
 * @throws Propagates spawn errors (e.g., command not found) naturally
 */
export async function runAI(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!VALID_MODELS.has(model)) {
    throw new Error(`Unknown model: "${model}". Valid models: ${[...VALID_MODELS].join(', ')}`);
  }
  const cmd = new Deno.Command('claude', {
    args: [
      '-p',
      systemPrompt,
      '--output-format',
      'text',
      '--permission-mode',
      'acceptEdits',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--model',
      model,
    ],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'null',
  });
  const process = cmd.spawn();
  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(userPrompt));
  await writer.close();
  const output = await process.output();
  if (!output.success) {
    throw new Error(`claude exited with code ${output.code}`);
  }
  return new TextDecoder().decode(output.stdout).trim();
}

/**
 * Splits a chatlog into topic-based segments by calling the Claude AI.
 *
 * Sends the chatlog content to Claude with a system prompt requesting a JSON
 * array of segments. Each segment has `title`, `summary`, and `body` fields.
 * At most {@link MAX_SEGMENTS} segments are returned.
 *
 * @param filePath - Path to the chatlog file (used for context in the prompt)
 * @param content  - Full text content of the chatlog file
 * @returns Promise resolving to an array of {@link Segment} objects, or `null`
 *          if the AI call fails or the response cannot be parsed as a JSON array
 */
export async function segmentChatlog(filePath: string, content: string): Promise<Segment[] | null> {
  const systemPrompt = 'You are a chatlog analyst. Split the given chatlog into topic-based segments. '
    + 'Return ONLY a JSON array where each element has exactly three string fields: '
    + '"title" (short topic title), "summary" (one-sentence summary), and "body" (relevant text). '
    + 'Do not include any explanation or markdown fences — respond with the JSON array only.';

  const userPrompt = `File: ${filePath}\n\n${content}`;

  let raw: string;
  try {
    raw = await runAI('sonnet', systemPrompt, userPrompt);
  } catch {
    return null;
  }

  const parsed = parseJsonArray(raw);
  if (parsed === null) {
    return null;
  }

  const segments = parsed as Segment[];
  return segments.slice(0, MAX_SEGMENTS);
}

// ─── File Operations ──────────────────────────────────────────────────────────

/**
 * Recursively collects all `.md` file paths under `dir`, appending to `results`.
 * Silently returns if `dir` does not exist.
 *
 * @param dir     - Directory path to scan
 * @param results - Accumulator array; `.md` file paths are pushed here
 */
export function collectMdFiles(dir: string, results: string[]): void {
  try {
    for (const entry of Deno.readDirSync(dir)) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        collectMdFiles(fullPath, results);
      } else if (entry.isFile && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Non-existent or unreadable directory: return silently
  }
}

/**
 * Returns a sorted list of all `.md` file paths found recursively under `dir`.
 *
 * @param dir - Directory path to scan
 * @returns Sorted array of `.md` file paths
 */
export function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  collectMdFiles(dir, results);
  return results.sort();
}

/**
 * Writes `content` to `outputPath` using a tmp-then-rename atomic pattern.
 *
 * Behavior:
 * 1. `dryRun=true` → log and return without writing.
 * 2. `outputPath` contains `temp/chatlog/` → throw Error (R-010 guard).
 * 3. `outputPath` already exists → `stats.skip++` and return (R-011).
 * 4. Write to `outputPath + ".tmp"`, then rename to `outputPath`, `stats.success++`.
 *
 * @param outputPath - Destination file path
 * @param content    - Text content to write
 * @param dryRun     - When true, no disk writes are performed
 * @param stats      - Mutable counters updated in place
 */
export async function writeOutput(
  outputPath: string,
  content: string,
  dryRun: boolean,
  stats: Stats,
): Promise<void> {
  if (dryRun) {
    console.log(`[dry-run] would write: ${outputPath}`);
    return;
  }

  if (outputPath.includes('temp/chatlog/')) {
    throw new Error(`R-010: writing to input directory is forbidden: ${outputPath}`);
  }

  try {
    await Deno.stat(outputPath);
    // File exists → skip
    stats.skip++;
    return;
  } catch {
    // File does not exist → proceed with write
  }

  const tmpPath = outputPath + '.tmp';
  await Deno.writeTextFile(tmpPath, content);
  await Deno.rename(tmpPath, outputPath);
  stats.success++;
}

/**
 * Outputs a summary report of batch processing results to stdout.
 *
 * Format: `Results: success=<n>, skip=<n>, fail=<n>`
 * When `stats.fail > 0`, an additional warning line is emitted to surface
 * the failure count explicitly.
 *
 * @param stats - Counters collected across a batch run
 */
export function reportResults(stats: Stats): void {
  console.log(`Results: success=${stats.success}, skip=${stats.skip}, fail=${stats.fail}`);
  if (stats.fail > 0) {
    console.log(`WARNING: ${stats.fail} file(s) failed`);
  }
}

// ─── Directory Resolution ─────────────────────────────────────────────────────

/**
 * Verifies that `dirPath` exists on the filesystem; exits with code 1 if not.
 *
 * @param dirPath - The directory path to check
 */
function assertDirExists(dirPath: string): void {
  try {
    Deno.statSync(dirPath);
  } catch {
    console.error(`Error: directory not found: ${dirPath}`);
    Deno.exit(1);
  }
}

/**
 * Resolves the input directory based on provided args.
 *
 * Resolution order:
 * 1. If `args.dir` is provided and exists, return it as-is.
 * 2. If `args.agent` and `args.yearMonth` are provided, construct
 *    `temp/chatlog/<agent>/<year>/<yearMonth>` and return it if it exists.
 * 3. Otherwise exit with usage error.
 *
 * @param args - Object with optional `dir`, `agent`, and `yearMonth` fields
 * @returns The resolved directory path as a string
 */
export function resolveInputDir(args: { dir?: string; agent?: string; yearMonth?: string }): string {
  if (args.dir !== undefined) {
    assertDirExists(args.dir);
    return args.dir;
  }
  if (args.agent !== undefined && args.yearMonth !== undefined) {
    const year = args.yearMonth.slice(0, 4);
    const resolvedPath = `temp/chatlog/${args.agent}/${year}/${args.yearMonth}`;
    assertDirExists(resolvedPath);
    return resolvedPath;
  }
  console.error('Error: --dir or (--agent and --year-month) must be specified');
  Deno.exit(1);
}

// ─── Argument Parsing ─────────────────────────────────────────────────────────

/**
 * Normalizes path separators by replacing all backslashes with forward slashes.
 *
 * @param p - The path string to normalize
 * @returns The normalized path string with `/` as separator
 */
function normalizePath(p: string): string {
  return p.replaceAll('\\', '/');
}

/**
 * Parses CLI arguments into a structured options object.
 *
 * Supported flags:
 *   --dir <path>           Input directory path (backslashes normalized to `/`)
 *   --agent <name>         Agent name (e.g. "claude")
 *   --year-month <YYYY-MM> Year-month string (mapped to `yearMonth`)
 *   --dry-run              Dry-run mode flag (default: false)
 *   --concurrency <n>      Max concurrent tasks (default: 4)
 *   --output <path>        Output path
 *
 * Positional arguments:
 *   Any non-flag argument containing `/` or `\` is treated as a directory
 *   path and automatically assigned to `dir` after path normalization.
 *
 * Unknown flags cause a `console.error` message followed by `Deno.exit(1)`.
 *
 * @param argv - Array of CLI argument strings
 * @returns Parsed options as a {@link ParsedArgs} object
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { concurrency: DEFAULT_CONCURRENCY, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dir':
        result.dir = normalizePath(argv[++i]);
        break;
      case '--agent':
        result.agent = argv[++i];
        break;
      case '--year-month':
        result.yearMonth = argv[++i];
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--concurrency':
        result.concurrency = Number(argv[++i]);
        break;
      case '--output':
        result.output = argv[++i];
        break;
      default: {
        const normalized = normalizePath(arg);
        if (!normalized.startsWith('--') && normalized.includes('/')) {
          // Positional path argument: already normalized, assign to dir
          result.dir = normalized;
        } else {
          console.error(`Error: unknown option: ${arg}`);
          Deno.exit(1);
        }
      }
    }
  }

  return result;
}

// ─── Concurrency ──────────────────────────────────────────────────────────────

/**
 * Executes an array of async tasks with a bounded concurrency limit,
 * returning results in input index order regardless of completion order.
 *
 * @param tasks - Array of zero-argument functions that return Promises
 * @param concurrency - Maximum number of tasks to run concurrently
 * @returns Promise resolving to results in input index order
 */
export async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= tasks.length) {
      return;
    }
    results[index] = await tasks[index]();
    await runNext();
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => runNext(),
  );
  await Promise.all(workers);

  return results;
}

// ─── Main Orchestration ───────────────────────────────────────────────────────

/** Default output directory for normalized segment files. */
const DEFAULT_OUTPUT_DIR = 'temp/normalize_logs';

/** Hardcoded agent name used for log ID generation. */
const AGENT_NAME = 'claude';

/**
 * Orchestrates the full normalize-chatlog pipeline.
 *
 * Flow: parseArgs → resolveInputDir → findMdFiles → withConcurrency(per-file:
 *   segmentChatlog → generateSegmentFile + attachFrontmatter + writeOutput) → reportResults
 *
 * @param argv - CLI argument array; defaults to `Deno.args` when omitted
 */
export async function main(argv?: string[]): Promise<void> {
  const args = parseArgs(argv ?? Deno.args);
  const inputDir = resolveInputDir(args);
  const outputDir = args.output ?? DEFAULT_OUTPUT_DIR;

  // Ensure output directory exists
  await Deno.mkdir(outputDir, { recursive: true });

  const mdFiles = findMdFiles(inputDir);
  const stats: Stats = { success: 0, skip: 0, fail: 0 };

  const tasks = mdFiles.map((filePath) => async () => {
    const content = await Deno.readTextFile(filePath);
    const { meta: sourceMeta } = parseFrontmatter(content);

    const segments = await segmentChatlog(filePath, content);
    if (segments === null) {
      stats.fail++;
      return;
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const logId = await generateLogId(filePath, AGENT_NAME, segment.title, i);
      const segmentContent = generateSegmentFile(segment);
      const fullContent = attachFrontmatter(segmentContent, sourceMeta, {
        title: segment.title,
        log_id: logId,
        summary: segment.summary,
      });
      const outputPath = `${outputDir}/${logId}.md`;
      await writeOutput(outputPath, fullContent, args.dryRun, stats);
    }
  });

  await withConcurrency(tasks, args.concurrency);

  reportResults(stats);
}

if (import.meta.main) {
  await main();
}
