// src: skills/_scripts/libs/__tests__/ai/unit/model-utils.unit.spec.ts
// @(#): isValidModel ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { isValidModel } from '../../model-utils.ts';

describe('isValidModel', () => {
  // 有効なショートエイリアス
  it('T-LIB-AI-01: returns true for "opus"', () => {
    assertEquals(isValidModel('opus'), true);
  });

  it('T-LIB-AI-02: returns true for "sonnet"', () => {
    assertEquals(isValidModel('sonnet'), true);
  });

  it('T-LIB-AI-03: returns true for "haiku"', () => {
    assertEquals(isValidModel('haiku'), true);
  });

  it('T-LIB-AI-04: returns true for "default"', () => {
    assertEquals(isValidModel('default'), true);
  });

  it('T-LIB-AI-05: returns true for "best"', () => {
    assertEquals(isValidModel('best'), true);
  });

  // 有効な特殊エイリアス
  it('T-LIB-AI-06: returns true for "sonnet[1m]"', () => {
    assertEquals(isValidModel('sonnet[1m]'), true);
  });

  it('T-LIB-AI-07: returns true for "opusplan"', () => {
    assertEquals(isValidModel('opusplan'), true);
  });

  // 有効なバージョン付き
  it('T-LIB-AI-08: returns true for "claude-opus-4-7"', () => {
    assertEquals(isValidModel('claude-opus-4-7'), true);
  });

  it('T-LIB-AI-09: returns true for "claude-sonnet-4-6"', () => {
    assertEquals(isValidModel('claude-sonnet-4-6'), true);
  });

  it('T-LIB-AI-10: returns true for "claude-haiku-4-5-20251001"', () => {
    assertEquals(isValidModel('claude-haiku-4-5-20251001'), true);
  });

  // 無効
  it('T-LIB-AI-11: returns false for "invalid-model"', () => {
    assertEquals(isValidModel('invalid-model'), false);
  });

  it('T-LIB-AI-12: returns false for "Opus" (case sensitive)', () => {
    assertEquals(isValidModel('Opus'), false);
  });

  it('T-LIB-AI-13: returns false for empty string', () => {
    assertEquals(isValidModel(''), false);
  });

  it('T-LIB-AI-14: returns false for "opus-" (partial match)', () => {
    assertEquals(isValidModel('opus-'), false);
  });
});
