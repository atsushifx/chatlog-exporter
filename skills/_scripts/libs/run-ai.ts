// src: skills/_scripts/libs/run-ai.ts
// @(#): Claude CLI 呼び出しユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { DEFAULT_AI_MODEL, DEFAULT_TIMEOUT_MS } from '../constants/common.constants.ts';
import { ChatlogError } from '../types/chatlog-error.types.ts';

/** Model IDs and aliases accepted by the Claude Code CLI. */
const _VALID_MODELS = new Set([
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'opus',
  'sonnet',
  'haiku',
]);

export type RunAIOptions = {
  model?: string;
  timeoutMs?: number;
};

/**
 * Runs a Claude CLI subprocess with the given system prompt and user prompt.
 * Returns the trimmed stdout text on success, or throws on failure.
 */
export async function runAI(
  systemPrompt: string,
  userPrompt: string,
  options?: RunAIOptions,
): Promise<string> {
  const _options = { model: DEFAULT_AI_MODEL, timeoutMs: DEFAULT_TIMEOUT_MS, ...options };
  if (!_VALID_MODELS.has(_options.model)) {
    throw new ChatlogError('UnknownModel', `"${_options.model}" is not valid. Valid models: ${[..._VALID_MODELS].join(', ')}`);
  }
  const _controller = new AbortController();
  const _timer = _options.timeoutMs !== 0
    ? setTimeout(() => _controller.abort(), _options.timeoutMs)
    : undefined;
  const _cmd = new Deno.Command('claude', {
    args: [
      '-p',
      '--system-prompt',
      systemPrompt,
      '--output-format',
      'text',
      '--permission-mode',
      'acceptEdits',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--model',
      _options.model,
    ],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'null',
    signal: _controller.signal,
  });
  try {
    const _process = _cmd.spawn();
    const _writer = _process.stdin.getWriter();
    await _writer.write(new TextEncoder().encode(userPrompt));
    await _writer.close();
    const _output = await _process.output();
    if (!_output.success) {
      throw new ChatlogError('CliError', `claude exited with code ${_output.code}`);
    }
    return new TextDecoder().decode(_output.stdout).trim();
  } catch (e) {
    if (_controller.signal.aborted) {
      throw new ChatlogError('TimedOut', `claude timed out after ${_options.timeoutMs}ms`);
    }
    throw e;
  } finally {
    if (_timer !== undefined) clearTimeout(_timer);
  }
}
