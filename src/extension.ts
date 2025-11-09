import * as vscode from 'vscode';

// ========================================================================
// 以下のロジックは sidepanel.js からそのまま移植されました
// ========================================================================

/**
 * 速く堅牢な \qty 変換（線形走査）
 * @param input 入力文字列
 * @returns 変換後の文字列
 */
function transformQtyLinear(input: string): string {
    const pairs: { [key: string]: string } = { '(': ')', '[': ']', '{': '}', '|': '|' };
    const sizeNames = new Set([
        'big', 'Big', 'bigg', 'Bigg',
        'bigl', 'Bigl', 'biggl', 'Biggl',
        'bigr', 'Bigr', 'biggr', 'Biggr',
        'bigm', 'Bigm', 'biggm', 'Biggm',
    ]);

    let out = '';
    let i = 0;
    const n = input.length;

    while (i < n) {
        // \qty の検出
        if (input[i] === '\\' && input.startsWith('\\qty', i)) {
            let j = i + 4;
            // オプションのスター
            if (j < n && input[j] === '*') j++;
            // 空白スキップ
            while (j < n && /\s/.test(input[j])) j++;
            if (j >= n) { out += input.slice(i); break; }

            // オプションのサイズ指定（\big 等）
            if (input[j] === '\\') {
                let kname = j + 1;
                while (kname < n && /[A-Za-z]/.test(input[kname])) kname++;
                const name = input.slice(j + 1, kname);
                if (sizeNames.has(name)) {
                    j = kname;
                    while (j < n && /\s/.test(input[j])) j++;
                }
            }
            if (j >= n) { out += input.slice(i); break; } // サイズ指定後に末尾に達した場合

            const opener = input[j];
            const closer = pairs[opener];
            if (!closer) {
                // 未対応の書式 → そのまま出力
                out += input.slice(i, j + 1);
                i = j + 1;
                continue;
            }

            // 内容スキャン
            let k = j + 1;
            let depthParen = opener === '(' ? 1 : 0;
            let depthBrack = opener === '[' ? 1 : 0;
            let depthBrace = opener === '{' ? 1 : 0;
            let found = false;

            while (k < n) {
                const ch = input[k];
                if (ch === '\\') {
                    // エスケープされたデリミタは深さに影響しない
                    const next = k + 1 < n ? input[k + 1] : '';
                    if (next === '(' || next === ')' || next === '[' || next === ']' || next === '{' || next === '}' || next === '|') {
                        k += 2;
                        continue;
                    }
                    // その他のコマンドは 1 文字だけ飛ばして継続
                    k += 1;
                    continue;
                }

                if (opener !== '|') {
                    if (ch === '(') depthParen++;
                    else if (ch === ')') { if (depthParen > 0) depthParen--; }
                    else if (ch === '[') depthBrack++;
                    else if (ch === ']') { if (depthBrack > 0) depthBrack--; }
                    else if (ch === '{') depthBrace++;
                    else if (ch === '}') { if (depthBrace > 0) depthBrace--; }

                    if ((opener === '(' && depthParen === 0) ||
                        (opener === '[' && depthBrack === 0) ||
                        (opener === '{' && depthBrace === 0)) {
                        found = true;
                        break; // k は対応する閉じ括弧位置
                    }
                    k++;
                } else {
                    // '|' の場合は次の非エスケープ '|' をマッチ
                    if (ch === '|') { found = true; break; }
                    k++;
                }
            }

            const left = opener === '{' ? '\\{' : opener;
            if (found) {
                const content = input.slice(j + 1, k);
                const right = closer === '}' ? '\\}' : closer;
                out += `\\left${left} ${content} \\right${right}`;
                i = k + 1;
                continue;
            } else {
                // 未閉じ: エラーとして扱う (VSCode拡張機能では例外を投げ、catchする)
                const kind = opener === '(' ? '()' : opener === '[' ? '[]' : opener === '{' ? '{}' : '||';
                throw new Error(`未閉じの \\qty デリミタを検出: 開き ${kind} に対応する閉じ括弧が見つかりません`);
            }
        }

        // 通常文字
        out += input[i];
        i++;
    }

    return out;
}

/**
 * メインのLaTeX変換ロジック
 * @param originalLatex 入力文字列
 * @param useMathrmD \dd を \mathrm{d} に変換するか
 * @param useBmToMathbf \bm を \mathbf に変換するか
 * @returns 変換後の文字列
 */
function convertLatex(originalLatex: string, useMathrmD: boolean, useBmToMathbf: boolean): string {
    let latex = originalLatex;

    // \para → \parallel
    latex = latex.replace(/\\para(?![a-zA-Z])/g, '\\parallel');

    // \i → \mathrm{i}
    latex = latex.replace(/\\i(?![a-zA-Z])/g, '\\mathrm{i}');
    // \e → \mathrm{e}
    latex = latex.replace(/\\e(?![a-zA-Z])/g, '\\mathrm{e}');

    // "text" → \mathrm{text}
    // 既に \text{...} または \mathrm{...} の内側にいる場合は変換しない
    latex = latex.replace(/"([^"]+)"/g, (match, p1) => {
        const idx = latex.indexOf(match);
        const textBefore = idx >= 0 ? latex.substring(0, idx) : '';
        if (/\\(?:text|mathrm)\{[^{}]*$/.test(textBefore)) {
            return match;
        }
        return `\\mathrm{${p1}}`;
    });
    
    const d_style = useMathrmD ? '\\mathrm{d}' : 'd';
    latex = latex.replace(/\\dd/g, d_style);

    // 重い正規表現を避け、線形走査で \qty(...) 等を \left..\right.. に変換
    latex = transformQtyLinear(latex);

    // バランスの取れた括弧の内容 (ネスト対応)
    const balancedBraceContent = "((?:[^{}]|\\{(?:[^{}]*|\\{(?:[^{}]*|\\{[^{}]*\\})*\\})*\\})*?)";
    const optArgPattern = "\\[([^\\]]*?)\\]";

    // \dv[order]{func}{var}
    const dvWithOrderRegex = new RegExp(`\\\\dv${optArgPattern}\\{${balancedBraceContent}\\}\\{${balancedBraceContent}\\}`, 'g');
    latex = latex.replace(dvWithOrderRegex, (match, order, func, variable) => {
        const o = order.trim();
        if (!o || o === "1") {
            return `\\frac{${d_style} ${func.trim()}}{${d_style} ${variable.trim()}}`;
        }
        return `\\frac{${d_style}^${o} ${func.trim()}}{${d_style} ${variable.trim()}^${o}}`;
    });
    // \dv{func}{var}
    const dvWithoutOrderRegex = new RegExp(`\\\\dv\\{${balancedBraceContent}\\}\\{${balancedBraceContent}\\}`, 'g');
    latex = latex.replace(dvWithoutOrderRegex, (match, func, variable) => {
        return `\\frac{${d_style} ${func.trim()}}{${d_style} ${variable.trim()}}`;
    });

    // \pdv[order]{func}{var}
    const pdvFuncVarWithOrderRegex = new RegExp(`\\\\pdv${optArgPattern}\\{${balancedBraceContent}\\}\\{${balancedBraceContent}\\}`, 'g');
    latex = latex.replace(pdvFuncVarWithOrderRegex, (match, order, func, variable) => {
        const o = order.trim();
        if (!o || o === "1") {
            return `\\frac{\\partial ${func.trim()}}{\\partial ${variable.trim()}}`;
        }
        return `\\frac{\\partial^${o} ${func.trim()}}{\\partial ${variable.trim()}^${o}}`;
    });
    // \pdv{func}{var}
    const pdvFuncVarWithoutOrderRegex = new RegExp(`\\\\pdv\\{${balancedBraceContent}\\}\\{${balancedBraceContent}\\}`, 'g');
    latex = latex.replace(pdvFuncVarWithoutOrderRegex, (match, func, variable) => {
        return `\\frac{\\partial ${func.trim()}}{\\partial ${variable.trim()}}`;
    });

    // \pdv[order]{var}
    const pdvVarOnlyWithOrderRegex = new RegExp(`\\\\pdv${optArgPattern}\\{${balancedBraceContent}\\}`, 'g');
    latex = latex.replace(pdvVarOnlyWithOrderRegex, (match, order, variable) => {
        const o = order.trim();
        if (!o || o === "1") {
            return `\\frac{\\partial}{\\partial ${variable.trim()}}`;
        }
        return `\\frac{\\partial^${o}}{\\partial ${variable.trim()}^${o}}`;
    });
    // \pdv{var}
    const pdvVarOnlyWithoutOrderRegex = new RegExp(`\\\\pdv\\{${balancedBraceContent}\\}`, 'g');
    latex = latex.replace(pdvVarOnlyWithoutOrderRegex, (match, variable) => {
        return `\\frac{\\partial}{\\partial ${variable.trim()}}`;
    });

    // \bm{...} -> \mathbf{...}
    if (useBmToMathbf) {
        const bmRegex = new RegExp(`\\\\bm\\{${balancedBraceContent}\\}`, 'g');
        latex = latex.replace(bmRegex, (match, content) => {
            return `\\mathbf{${content.trim()}}`;
        });
    }

    return latex;
}

// ========================================================================
// VS Code 拡張機能としての登録ロジック (自動範囲検出あり)
// ========================================================================

export function activate(context: vscode.ExtensionContext) {

    console.log('KaTeX Helper (Macro Expander) is now active!');

    // コマンドを登録
    let disposable = vscode.commands.registerCommand('my-katex-helper.expandMacros', () => {
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('エディタが開かれていません。');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;

        let targetRange: vscode.Range | undefined = undefined;

        if (selection.isEmpty) {
            // --- 何も選択されていない場合：カーソル位置から $...$ や $$...$$ を探す ---
            
            const cursorPosition = selection.active;
            const text = document.getText();
            const offset = document.offsetAt(cursorPosition);

            // まず $$...$$ (display math) を探す。開始の $$ を見つけたら、その直後から次の $$ を探す。
            let startDelimiter = text.lastIndexOf('$$', Math.max(0, offset - 1));
            if (startDelimiter !== -1) {
                const endDelimiter = text.indexOf('$$', startDelimiter + 2);
                if (endDelimiter !== -1 && startDelimiter < offset && offset <= endDelimiter) {
                    const startPos = document.positionAt(startDelimiter + 2);
                    const endPos = document.positionAt(endDelimiter);
                    targetRange = new vscode.Range(startPos, endPos);
                }
            }

            // $$...$$ が見つからなかった、あるいはカーソルがその内側ではなかった場合は $...$ を探す
            if (!targetRange) {
                // 前方の '$' と後方の '$' を、それぞれ $$ の一部でないものとして見つける
                let start = text.lastIndexOf('$', Math.max(0, offset - 1));
                // skip if this $ is part of $$ (i.e. preceded or followed by $)
                while (start > 0 && text.charAt(start - 1) === '$') {
                    start = text.lastIndexOf('$', start - 2);
                }

                if (start !== -1) {
                    let end = text.indexOf('$', start + 1);
                    while (end !== -1 && text.charAt(end + 1) === '$') {
                        end = text.indexOf('$', end + 2);
                    }
                    // 範囲が存在し、かつカーソルがその内側にあることを確認
                    if (end !== -1 && start < offset && offset <= end) {
                        const startPos = document.positionAt(start + 1);
                        const endPos = document.positionAt(end);
                        targetRange = new vscode.Range(startPos, endPos);
                    }
                }
            }

            if (!targetRange) {
                vscode.window.showInformationMessage('変換範囲が見つかりません。$..$ または $$..$$ の内側にカーソルを置くか、範囲を選択してください。');
                return;
            }

        } else {
            // --- 何かを選択している場合：その選択範囲を対象とする ---
            targetRange = selection;
        }

        // --- 変換の実行 ---
        const targetText = document.getText(targetRange);
        if (!targetText) {
            return; // 対象テキストが空
        }

        try {
            // オプションはひとまず true に固定 (将来的にはVSCodeの設定で変えられる)
            const useMathrmD = true;
            const useBmToMathbf = true;
            
            const convertedLatex = convertLatex(targetText, useMathrmD, useBmToMathbf);

            // 変換後のテキストで置き換え
            if (targetText !== convertedLatex) {
                editor.edit(editBuilder => {
                    if (targetRange) { // targetRangeがundefinedでないことを確認
                        editBuilder.replace(targetRange, convertedLatex);
                    }
                });
            } else {
                vscode.window.showInformationMessage('置換対象のマクロが見つかりませんでした。');
            }

        } catch (e: any) {
            // 例: transformQtyLinear で未閉じエラーが発生した場合
            console.error("KaTeX Macro Expansion Error:", e);
            vscode.window.showErrorMessage(`マクロの展開に失敗しました: ${e.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

// 拡張機能が非アクティブ化されるときの処理
export function deactivate() {}