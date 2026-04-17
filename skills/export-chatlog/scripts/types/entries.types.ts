// src: scripts/types/entries.ts
// @(#): パーサー入力型定義（JSONL エントリ）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/**
 * Claude JSONL ファイルの1行を表す入力エントリ型。
 *
 * `~/.claude/projects/<project>/*.jsonl` の各行を JSON パースした結果に対応する。
 * `parseClaudeSession` が読み込み・フィルタリングに使用する。
 *
 * `isMeta: true` のエントリはセッションメタ情報のみを保持し、会話ターンとしては扱わない。
 * `type` が "user" または "assistant" でかつ `isMeta` が false のエントリが会話本体になる。
 *
 * @see parseClaudeSession
 * @see extractClaudeUserText
 * @see extractClaudeAssistantText
 */
export interface ClaudeEntry {
  /** エントリ種別。"user"、"assistant"、またはその他のシステムエントリ */
  type: string;
  /** true のとき会話ターンではなくメタ情報エントリとして扱い、ターン抽出でスキップする */
  isMeta?: boolean;
  /** セッションの一意識別子。全エントリで共通の値を持つ */
  sessionId?: string;
  /** エントリの ISO8601 タイムスタンプ。期間フィルタ（`inPeriod`）に使用する */
  timestamp?: string;
  /** Claude が付与するセッションスラッグ。`SessionMeta.slug` の候補として使用する */
  slug?: string;
  /** セッション開始時の作業ディレクトリ。`SessionMeta.project` の推定に使用する */
  cwd?: string;
  /** メッセージ本体。content フィールドに実際のテキストが格納される */
  message?: {
    /**
     * ストリーミング連結判定に使用するメッセージ ID。
     * 同一 ID を持つ連続 assistant エントリはテキスト連結してひとつのターンとして扱う。
     */
    id?: string;
    /**
     * メッセージの本文。文字列または構造化コンテンツ配列（`Array<{type, text, ...}>`）。
     * `extractClaudeUserText` / `extractClaudeAssistantText` が解析する。
     */
    content?: unknown;
  };
}

/**
 * Codex JSONL ファイルの1行を表す入力エントリ型。
 *
 * `~/.codex/sessions/YYYY/MM/DD/*.jsonl` の各行を JSON パースした結果に対応する。
 * `parseCodexSession` が読み込み・フィルタリングに使用する。
 *
 * `type === "session_meta"` のエントリがセッション識別情報（ID・cwd）を保持し、
 * `type === "response_item"` のエントリが会話ターン本体になる。
 *
 * @see parseCodexSession
 */
/**
 * ChatGPT conversations-*.json の1会話オブジェクトを表す型。
 */
export interface ChatGPTConversation {
  id: string;
  conversation_id: string;
  create_time: number; // Unix timestamp (float)
  title: string;
  default_model_slug?: string;
  current_node?: string; // 末尾ノードID（optional）
  mapping: Record<string, ChatGPTMappingNode>;
}

/**
 * ChatGPT conversations の mapping 内の1ノードを表す型。
 */
export interface ChatGPTMappingNode {
  id: string;
  message: ChatGPTMessage | null;
  parent: string | null;
  children: string[];
}

/**
 * ChatGPT メッセージ本体を表す型。
 */
export interface ChatGPTMessage {
  id: string;
  author: { role: string };
  create_time: number | null;
  content: {
    content_type: string;
    parts?: unknown[];
  };
  weight?: number;
}

export interface CodexEntry {
  /** エントリの ISO8601 タイムスタンプ（必須）。session_meta の値で期間フィルタを行う */
  timestamp: string;
  /** エントリ種別。"session_meta"（セッション情報）または "response_item"（会話ターン） */
  type: string;
  /** エントリの内容。type に応じてフィールドの意味が異なる */
  payload: {
    /**
     * session_meta 時はセッション ID。
     * `SessionMeta.sessionId` に格納される。
     */
    id?: string;
    /**
     * session_meta 時は作業ディレクトリ。
     * `SessionMeta.project` の推定に使用する。
     */
    cwd?: string;
    /** payload の詳細種別（補助フィールド） */
    type?: string;
    /** response_item 時の発話者役割。"user" または "assistant" */
    role?: string;
    /**
     * response_item 時の本文コンテンツ配列。
     * user の場合は `type === "input_text"`、assistant の場合は `type === "output_text"` を持つ。
     */
    content?: Array<{ type: string; text?: string }>;
  };
}
