// src: scripts/__tests__/functional/classify-chatlog.build-config.functional.spec.ts
// @(#): buildConfig の機能テスト
//       ParsedConfig + GlobalConfig + デフォルト値から ClassifyConfig を構築するロジック
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// -- BDD modules --
import { assertEquals, assertThrows } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { buildConfig } from '../../classify-chatlog.ts';
// classes
import { ChatlogError } from '../../../../_scripts/classes/ChatlogError.class.ts';
import { GlobalConfig } from '../../../../_scripts/classes/GlobalConfig.class.ts';
// constants
import { DEFAULT_AI_MODEL } from '../../../../_scripts/constants/defaults.constants.ts';
import { DEFAULT_CLASSIFY_CONFIG } from '../../constants/classify.constants.ts';
// types
import type { ParsedConfig } from '../../types/classify.types.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const _existsStat = (_path: string) => Promise.resolve({ isFile: true } as Deno.FileInfo);

/** テスト用 GlobalConfig を作成する（YAML 文字列から）。 */
async function _makeGlobalConfig(yaml: string): Promise<GlobalConfig> {
  GlobalConfig.resetInstance();
  return await GlobalConfig.getInstance({
    readTextFileProvider: () => Promise.resolve(yaml),
    statProvider: _existsStat,
    configFile: 'dummy.yaml',
  });
}

/** 空の ParsedConfig。 */
const _EMPTY_PARSED: ParsedConfig = {};

// ─── T-CL-BC-01: model 優先順位 parsed > globalConfig ─────────────────────────

describe('buildConfig', () => {
  afterEach(() => {
    GlobalConfig.resetInstance();
  });

  // ─── model 優先順位 ─────────────────────────────────────────────────────────

  describe('Given: parsed.model が指定されている', () => {
    describe('When: GlobalConfig にも model が設定されている', () => {
      describe('Then: T-CL-BC-01 - parsed.model が優先される', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await _makeGlobalConfig('model: haiku');
        });
        it('T-CL-BC-01-01: parsed.model=opus → result.model === opus', () => {
          const result = buildConfig({ ..._EMPTY_PARSED, model: 'opus' }, globalConfig);
          assertEquals(result.model, 'opus');
        });
      });
    });
  });

  describe('Given: parsed.model が未指定', () => {
    describe('When: GlobalConfig に model が設定されている', () => {
      describe('Then: T-CL-BC-02 - GlobalConfig の model が使われる', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await _makeGlobalConfig('model: haiku');
        });
        it('T-CL-BC-02-01: globalConfig.model=haiku → result.model === haiku', () => {
          const result = buildConfig(_EMPTY_PARSED, globalConfig);
          assertEquals(result.model, 'haiku');
        });
      });
    });

    describe('When: GlobalConfig にも model が設定されていない', () => {
      describe('Then: T-CL-BC-03 - DEFAULT_CLASSIFY_CONFIG.model が使われる', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await _makeGlobalConfig('agent: claude');
        });
        it('T-CL-BC-03-01: model 未設定 → result.model === DEFAULT_AI_MODEL', () => {
          const result = buildConfig(_EMPTY_PARSED, globalConfig);
          assertEquals(result.model, DEFAULT_AI_MODEL);
        });
      });
    });

    describe('When: GlobalConfig に不正モデル名が設定されている', () => {
      describe('Then: T-CL-BC-04 - ChatlogError(InvalidArgs) がスローされる', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          // model キーを持たない空スキーマ → get('model') が undefined を返す
          globalConfig = await GlobalConfig.getInstance({ schema: {} });
        });
        it('T-CL-BC-04-01: globalConfig に model なし + defaults.model=invalid → ChatlogError(InvalidArgs)', () => {
          assertThrows(
            () =>
              buildConfig(_EMPTY_PARSED, globalConfig, {
                ...DEFAULT_CLASSIFY_CONFIG,
                model: 'invalid-model',
              }),
            ChatlogError,
          );
        });
      });
    });
  });

  // ─── dicsDir 優先順位 ────────────────────────────────────────────────────────

  describe('Given: GlobalConfig に dicsDir が設定されている', () => {
    describe('When: buildConfig を呼び出す', () => {
      describe('Then: T-CL-BC-05 - GlobalConfig の dicsDir が使われる', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await _makeGlobalConfig('dicsDir: /custom/dics');
        });
        it('T-CL-BC-05-01: globalConfig.dicsDir=/custom/dics → result.dicsDir === /custom/dics', () => {
          const result = buildConfig(_EMPTY_PARSED, globalConfig);
          assertEquals(result.dicsDir, '/custom/dics');
        });
      });
    });
  });

  describe('Given: GlobalConfig に dicsDir が設定されていない', () => {
    describe('When: buildConfig を呼び出す', () => {
      describe('Then: T-CL-BC-06 - DEFAULT_CLASSIFY_CONFIG.dicsDir が使われる', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await _makeGlobalConfig('agent: claude');
        });
        it('T-CL-BC-06-01: dicsDir 未設定 → result.dicsDir === DEFAULT_CLASSIFY_CONFIG.dicsDir', () => {
          const result = buildConfig(_EMPTY_PARSED, globalConfig);
          assertEquals(result.dicsDir, DEFAULT_CLASSIFY_CONFIG.dicsDir);
        });
      });
    });
  });

  // ─── parsed フィールドの上書き ───────────────────────────────────────────────

  describe('Given: parsed に dryRun=true, inputDir が指定されている', () => {
    describe('When: buildConfig を呼び出す', () => {
      describe('Then: T-CL-BC-07 - parsed フィールドがデフォルトを上書きする', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await GlobalConfig.getInstance();
        });
        it('T-CL-BC-07-01: parsed.dryRun=true → result.dryRun === true', () => {
          const result = buildConfig({ ..._EMPTY_PARSED, dryRun: true, inputDir: '/custom/input' }, globalConfig);
          assertEquals(result.dryRun, true);
          assertEquals(result.inputDir, '/custom/input');
        });
      });
    });
  });

  // ─── configFile が結果に含まれない ───────────────────────────────────────────

  describe('Given: parsed に configFile が指定されている', () => {
    describe('When: buildConfig を呼び出す', () => {
      describe('Then: T-CL-BC-08 - result に configFile フィールドが含まれない', () => {
        let globalConfig: GlobalConfig;
        beforeEach(async () => {
          globalConfig = await GlobalConfig.getInstance();
        });
        it('T-CL-BC-08-01: parsed.configFile → result に configFile が含まれない', () => {
          const result = buildConfig({ ..._EMPTY_PARSED, configFile: 'custom.yaml' }, globalConfig);
          assertEquals('configFile' in result, false);
        });
      });
    });
  });
});
