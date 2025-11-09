# KaTeX Physics for Markdown
Markdownファイル内での数式入力を簡潔にするためのVSCode拡張機能。

## インストール方法

### 方法1: VSIXファイルから手動インストール
1. リポジトリをクローンまたはダウンロード
2. ターミナルで以下を実行してビルド:
   ```bash
   npm install
   npm run compile
   npm run package
   ```
3. 生成された `katex-physics-for-markdown-0.0.1.vsix` を VS Code でインストール:
   - VS Code のコマンドパレット（Ctrl+Shift+P）を開く
   - 「Extensions: Install from VSIX...」を選択
   - 生成された `.vsix` ファイルを選択

### 方法2: 開発モードで実行
1. VS Code でこのフォルダを開く
2. `F5` キーを押して拡張機能開発ホストを起動

## 概要
このVSCode拡張機能は、Markdown内で数式を編集する際に、物理表記（ベクトル、テンソル、微分記法など）を手早く挿入・展開するためのコマンドとスニペットを提供する。

## 使い方
Markdownファイル内でインライン数式`$...$`または独立数式`$$...$$`内にカーソルを置き、Ctrl+Shift+P -> 「KaTeX:選択範囲のマクロを展開する(Physics対応)」を選択する。
前後の$または$$を検出し、エラーがなければそれらに挟まれた範囲のマクロを展開する。

## サポートしている主要マクロ（抜粋）

- `\qty(...)` : 自動で `\left...\right...` に展開
- `\dv{f}{x}` / `\dv[n]{f}{x}` : 常微分の分数表記に展開
- `\pdv{f}{x}` / `\pdv[n]{f}{x}` / `\pdv{}` : 偏微分の分数表記に展開
- `\dd` : 微分の d を `\mathrm{d}` に変換（設定で切替可）
- `\i`, `\e` : それぞれ `\mathrm{i}`, `\mathrm{e}` に変換
- `"text"` : 二重引用符で囲んだ文字列を `\mathrm{...}` に変換
- `\para` → `\parallel`
- `\bm{...}` → `\mathbf{...}`（オプションで有効）

（拡張内の変換ロジックに基づく主要なマクロの一覧です。詳細はソースコードの `src/extension.ts` を参照してください。）

## 使えるコマンド一覧（ショートカットではなくマクロ）

以下はこの拡張でテキスト内に使える（展開対象となる）マクロの一覧です。表にない細かなバリエーション（オプション引数やエスケープ）はソース実装に従います。

| マクロ | 説明 | 例（変換前）| 例（変換後） |
|---|---|---|---|
| `\qty{...}` / `\qty(...)` / `\qty[...]` | 区切り文字に応じて `\left...\right...` に変換 | `\qty( a + b )` | `\left( a + b \right)` |
| `\dv{f}{x}` | 常微分：1次 | `\dv{y}{x}` | `\frac{\mathrm{d} y}{\mathrm{d} x}` |
| `\dv[n]{f}{x}` | 常微分：n次 | `\dv[2]{y}{x}` | `\frac{\mathrm{d}^2 y}{\mathrm{d} x^2}` |
| `\pdv{f}{x}` | 偏微分：1次（関数と変数） | `\pdv{f}{x}` | `\frac{\partial f}{\partial x}` |
| `\pdv[n]{f}{x}` | 偏微分：n次（関数と変数） | `\pdv[3]{f}{x}` | `\frac{\partial^3 f}{\partial x^3}` |
| `\pdv{x}` | 偏微分作用素（変数のみ） | `\pdv{x}` | `\frac{\partial}{\partial x}` |
| `\dd` | 微分の d を `\mathrm{d}` に変換 | `\dd x` | `\mathrm{d} x` |
| `\i`, `\e` | それぞれ `\mathrm{i}`, `\mathrm{e}` に変換 | `\i` | `\mathrm{i}` |
| `"..."` | 二重引用符を `\mathrm{...}` に変換 | `"eq"` | `\mathrm{eq}` |
| `\para` | `\parallel` に変換 | `\para` | `\parallel` |
| `\bm{...}` | オプションで `\mathbf{...}` に置換 | `\bm{v}` | `\mathbf{v}` |

## ライセンス
Undefined (Waiting for reply of email.)