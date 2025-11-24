import OpenAI from "openai";
import type { PRDetails, PRFile } from "./github-client";

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Summarize PR using OpenAI
   */
  async summarizePR(prData: PRDetails): Promise<string> {
    const { pr, files } = prData;

    // Prepare file changes summary
    const fileChanges = files
      .slice(0, 20)
      .map((f: PRFile) => `- ${f.filename ?? "unknown"} (+${f.additions}/-${f.deletions})`)
      .join("\n");

    const prompt = `以下のRuby on Rails PRを日本語で要約・解説してください。

PR情報:
- タイトル: ${pr.title}
- 番号: #${pr.number}
- 作成者: ${pr.user?.login ?? "unknown"}
- マージ日時: ${pr.merged_at}
- 説明:
${pr.body ?? "説明なし"}

変更されたファイル (最大20件):
${fileChanges}
${files.length > 20 ? `\n... 他 ${files.length - 20} ファイル` : ""}

統計:
- 変更ファイル数: ${files.length}
- 追加行数: ${pr.additions}
- 削除行数: ${pr.deletions}

以下の形式で出力してください:
1. 概要 (1-2文で)
2. 変更内容の詳細(あればサンプルコードも含めて)
3. 影響範囲・注意点
4. 参考情報 (あれば)

技術的に正確で、開発者にとって有益な情報を含めてください。`;

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-5.1",
        prompt_cache_retention: "24h",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      return completion.choices[0]?.message.content ?? "要約を生成できませんでした";
    } catch (error) {
      console.error(
        `Error summarizing PR #${pr.number}:`,
        error instanceof Error ? error.message : String(error),
      );
      return `要約エラー: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
