// src: scripts/__tests__/_helpers/deno-command-mock.ts
// @(#): Deno.Command モック用ヘルパー (runAI / segmentChatlog テスト用)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// ─── 型定義 ────────────────────────────────────────────────────────────────────

/** Deno.Command の最小インターフェイス。テスト用モッククラスが実装する型。 */
export type DenoCommandLike = new(cmd: string, opts: { args: string[] }) => {
  spawn(): {
    stdin: { getWriter(): { write(d: Uint8Array): Promise<void>; close(): Promise<void> } };
    output(): Promise<{ success: boolean; code: number; stdout: Uint8Array }>;
  };
};

// ─── 抽象基底クラス ────────────────────────────────────────────────────────────

/** spawn() 共通骨格と no-op stdin writer を提供する抽象基底クラス。 */
export abstract class BaseMockCommand {
  /** no-op stdin writer を返す。全サブクラスで共有する。 */
  protected static makeStdin() {
    return {
      getWriter() {
        return {
          write(_data: Uint8Array) {
            return Promise.resolve();
          },
          close() {
            return Promise.resolve();
          },
        };
      },
    };
  }

  /** spawn() の共通骨格。makeOutput() をサブクラスで実装する。 */
  spawn() {
    return {
      stdin: BaseMockCommand.makeStdin(),
      output: () => this.makeOutput(),
    };
  }

  /** サブクラスごとに success/code/stdout を返す抽象メソッド。 */
  protected abstract makeOutput(): Promise<{ success: boolean; code: number; stdout: Uint8Array }>;
}

// ─── 具体クラス ────────────────────────────────────────────────────────────────

/**
 * 正常終了(exit 0)を模倣するモッククラス。
 * stdout の内容と constructor に渡された args を検査できる。
 */
export class SuccessMockCommand extends BaseMockCommand {
  private readonly stdout: Uint8Array;
  private readonly capturedArgs?: { value: string[] };

  constructor(
    _cmd: string,
    opts: { args: string[] },
    stdout: Uint8Array,
    capturedArgs?: { value: string[] },
  ) {
    super();
    this.stdout = stdout;
    this.capturedArgs = capturedArgs;
    if (this.capturedArgs) { this.capturedArgs.value = opts.args; }
  }

  protected makeOutput(): Promise<{ success: boolean; code: number; stdout: Uint8Array }> {
    return Promise.resolve({ success: true, code: 0, stdout: this.stdout });
  }
}

/** 非ゼロ exit code を模倣するモッククラス。 */
export class FailMockCommand extends BaseMockCommand {
  private readonly code: number;

  constructor(_cmd: string, _opts: unknown, code: number) {
    super();
    this.code = code;
  }

  protected makeOutput(): Promise<{ success: boolean; code: number; stdout: Uint8Array }> {
    return Promise.resolve({ success: false, code: this.code, stdout: new Uint8Array() });
  }
}

/** spawn() で Deno.errors.NotFound をスローするモッククラス。 */
export class NotFoundMockCommand extends BaseMockCommand {
  constructor(_cmd: string, _opts: unknown) {
    super();
  }

  override spawn(): never {
    throw new Deno.errors.NotFound('claude');
  }

  protected makeOutput(): Promise<{ success: boolean; code: number; stdout: Uint8Array }> {
    // 到達しない（spawn がスローする）
    return Promise.resolve({ success: false, code: 1, stdout: new Uint8Array() });
  }
}

/** 呼び出し回数をカウントするモッククラス。 */
export class CountingMockCommand extends BaseMockCommand {
  private readonly responseText: string;

  constructor(_cmd: string, _opts: unknown, responseText: string, counter: { calls: number }) {
    super();
    this.responseText = responseText;
    counter.calls++;
  }

  protected makeOutput(): Promise<{ success: boolean; code: number; stdout: Uint8Array }> {
    return Promise.resolve({
      success: true,
      code: 0,
      stdout: new TextEncoder().encode(this.responseText),
    });
  }
}

// ─── ファクトリヘルパー ────────────────────────────────────────────────────────

/**
 * SuccessMockCommand を DenoCommandLike として返すヘルパー。
 * Deno.Command の置き換えに使用する。
 */
export function makeSuccessMock(
  stdout: Uint8Array,
  capturedArgs?: { value: string[] },
): DenoCommandLike {
  return class extends SuccessMockCommand {
    constructor(cmd: string, opts: { args: string[] }) {
      super(cmd, opts, stdout, capturedArgs);
    }
  };
}

/** FailMockCommand を DenoCommandLike として返すヘルパー。 */
export function makeFailMock(code: number): DenoCommandLike {
  return class extends FailMockCommand {
    constructor(cmd: string, opts: unknown) {
      super(cmd, opts, code);
    }
  } as unknown as DenoCommandLike;
}

/** NotFoundMockCommand を DenoCommandLike として返すヘルパー。 */
export function makeNotFoundMock(): DenoCommandLike {
  return NotFoundMockCommand as unknown as DenoCommandLike;
}

/** CountingMockCommand を DenoCommandLike として返すヘルパー。 */
export function makeCountingMock(responseText: string, counter: { calls: number }): DenoCommandLike {
  return class extends CountingMockCommand {
    constructor(cmd: string, opts: unknown) {
      super(cmd, opts, responseText, counter);
    }
  } as unknown as DenoCommandLike;
}
