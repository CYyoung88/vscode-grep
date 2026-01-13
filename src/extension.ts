import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface GrepOptions {
    caseInsensitive: boolean;
    invertMatch: boolean;
    wholeWord: boolean;
    contextBefore: number;
    contextAfter: number;
    pattern: string;
}

interface MatchLine {
    lineNumber: number;
    content: string;
    isMatch: boolean;
    matchPositions?: Array<{ start: number; end: number }>;
}

interface MatchBlock {
    matchLine: number;
    lines: MatchLine[];
}

// Store search pattern for each document URI
const searchPatterns = new Map<string, { pattern: string; options: GrepOptions }>();

export function activate(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('grep.search', async () => {
        // Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const fileName = path.basename(document.fileName);

        // Get user input
        const input = await vscode.window.showInputBox({
            prompt: 'Enter grep pattern and options (e.g., -i -A 3 keyword)',
            placeHolder: 'Pattern and options...'
        });

        if (!input) {
            return;
        }

        try {
            // Parse input
            const options = parseGrepOptions(input);
            
            // Perform grep search
            const matches = performGrep(document, options);
            
            // Format results
            const resultText = formatResults(fileName, matches, options);
            
            // Create temporary file
            const tempFile = await createTempFile(resultText);
            
            // Store search pattern for highlighting
            searchPatterns.set(tempFile.fsPath, { pattern: options.pattern, options });
            
            // Open result file
            const doc = await vscode.workspace.openTextDocument(tempFile);
            const resultEditor = await vscode.window.showTextDocument(doc);
            
            // Apply highlighting after a short delay to ensure document is fully loaded
            setTimeout(() => {
                highlightSearchPattern(resultEditor, options);
            }, 100);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Grep error: ${error.message}`);
        }
    });

    // Listen for document changes to re-apply highlighting
    const onDidChangeTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            const uri = editor.document.uri.fsPath;
            const stored = searchPatterns.get(uri);
            if (stored) {
                highlightSearchPattern(editor, stored.options);
            }
        }
    });

    context.subscriptions.push(command, onDidChangeTextEditor);
}

function parseGrepOptions(input: string): GrepOptions {
    const options: GrepOptions = {
        caseInsensitive: false,
        invertMatch: false,
        wholeWord: false,
        contextBefore: 0,
        contextAfter: 0,
        pattern: ''
    };

    const parts = input.trim().split(/\s+/);
    const args: string[] = [];
    let i = 0;

    while (i < parts.length) {
        const part = parts[i];
        
        if (part === '-i' || part === '--ignore-case') {
            options.caseInsensitive = true;
        } else if (part === '-v' || part === '--invert-match') {
            options.invertMatch = true;
        } else if (part === '-w' || part === '--word-regexp') {
            options.wholeWord = true;
        } else if (part === '-A' || part === '--after-context') {
            i++;
            if (i < parts.length) {
                options.contextAfter = parseInt(parts[i], 10) || 0;
            }
        } else if (part === '-B' || part === '--before-context') {
            i++;
            if (i < parts.length) {
                options.contextBefore = parseInt(parts[i], 10) || 0;
            }
        } else if (part === '-C' || part === '--context') {
            i++;
            if (i < parts.length) {
                const context = parseInt(parts[i], 10) || 0;
                options.contextBefore = context;
                options.contextAfter = context;
            }
        } else if (part.startsWith('-')) {
            // Unknown option, skip
        } else {
            args.push(part);
        }
        i++;
    }

    // Remaining parts form the pattern
    options.pattern = args.join(' ');

    if (!options.pattern) {
        throw new Error('No search pattern specified');
    }

    return options;
}

function performGrep(document: vscode.TextDocument, options: GrepOptions): MatchBlock[] {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const matches: MatchBlock[] = [];
    const processedLines = new Set<number>();

    // Build regex pattern
    let pattern = options.pattern;
    if (options.wholeWord) {
        pattern = `\\b${escapeRegex(pattern)}\\b`;
    } else {
        pattern = escapeRegex(pattern);
    }

    const flags = options.caseInsensitive ? 'gim' : 'gm';
    const regex = new RegExp(pattern, flags);

    // Find all matching lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matchesInLine = [...line.matchAll(regex)];
        
        if (matchesInLine.length > 0 !== options.invertMatch) {
            // This line matches (or doesn't match if invertMatch is true)
            const matchBlock: MatchBlock = {
                matchLine: i + 1,
                lines: []
            };

            // Add context before
            const contextStart = Math.max(0, i - options.contextBefore);
            for (let j = contextStart; j < i; j++) {
                if (!processedLines.has(j)) {
                    matchBlock.lines.push({
                        lineNumber: j + 1,
                        content: lines[j],
                        isMatch: false
                    });
                    processedLines.add(j);
                }
            }

            // Store match positions for highlighting
            const matchPositions: Array<{ start: number; end: number }> = [];
            for (const match of matchesInLine) {
                if (match.index !== undefined) {
                    matchPositions.push({
                        start: match.index,
                        end: match.index + match[0].length
                    });
                }
            }

            // Add matching line
            matchBlock.lines.push({
                lineNumber: i + 1,
                content: line,
                isMatch: true,
                matchPositions
            });
            processedLines.add(i);

            // Add context after
            const contextEnd = Math.min(lines.length - 1, i + options.contextAfter);
            for (let j = i + 1; j <= contextEnd; j++) {
                if (!processedLines.has(j)) {
                    matchBlock.lines.push({
                        lineNumber: j + 1,
                        content: lines[j],
                        isMatch: false
                    });
                    processedLines.add(j);
                }
            }

            matches.push(matchBlock);
        }
    }

    // Merge overlapping blocks
    return mergeMatchBlocks(matches);
}

function mergeMatchBlocks(blocks: MatchBlock[]): MatchBlock[] {
    if (blocks.length === 0) {
        return [];
    }

    // Sort by match line number
    blocks.sort((a, b) => a.matchLine - b.matchLine);

    const merged: MatchBlock[] = [];
    let current = blocks[0];

    for (let i = 1; i < blocks.length; i++) {
        const next = blocks[i];
        const currentMaxLine = Math.max(...current.lines.map(l => l.lineNumber));
        const nextMinLine = Math.min(...next.lines.map(l => l.lineNumber));

        if (nextMinLine <= currentMaxLine + 1) {
            // Merge blocks
            const allLines = new Map<number, MatchLine>();
            
            for (const line of current.lines) {
                allLines.set(line.lineNumber, line);
            }
            
            for (const line of next.lines) {
                const existing = allLines.get(line.lineNumber);
                if (existing) {
                    // Keep match status if either is a match
                    allLines.set(line.lineNumber, {
                        ...line,
                        isMatch: existing.isMatch || line.isMatch
                    });
                } else {
                    allLines.set(line.lineNumber, line);
                }
            }

            current = {
                matchLine: current.matchLine,
                lines: Array.from(allLines.values()).sort((a, b) => a.lineNumber - b.lineNumber)
            };
        } else {
            merged.push(current);
            current = next;
        }
    }

    merged.push(current);
    return merged;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatResults(fileName: string, matches: MatchBlock[], options: GrepOptions): string {
    if (matches.length === 0) {
        return `No matches found for pattern: ${options.pattern}`;
    }

    let result = '';
    
    for (const block of matches) {
        for (const line of block.lines) {
            const prefix = line.isMatch ? '>>>' : '   ';
            result += `${prefix}${fileName}:${line.lineNumber}:${line.content}\n`;
        }
        // Add separator between blocks
        if (block !== matches[matches.length - 1]) {
            result += '---\n';
        }
    }

    return result;
}

async function createTempFile(content: string): Promise<vscode.Uri> {
    const tempDir = os.tmpdir();
    const tempFileName = `grep-result-${Date.now()}.grepresult`;
    const tempFilePath = path.join(tempDir, tempFileName);

    return new Promise((resolve, reject) => {
        fs.writeFile(tempFilePath, content, 'utf8', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(vscode.Uri.file(tempFilePath));
            }
        });
    });
}

function highlightSearchPattern(editor: vscode.TextEditor, options: GrepOptions) {
    const document = editor.document;
    const decorations: vscode.DecorationOptions[] = [];

    // Build regex pattern for highlighting
    let pattern = options.pattern;
    if (options.wholeWord) {
        pattern = `\\b${escapeRegex(pattern)}\\b`;
    } else {
        pattern = escapeRegex(pattern);
    }

    const flags = options.caseInsensitive ? 'gim' : 'gm';
    const regex = new RegExp(pattern, flags);

    // Find all matches in the result document
    // Only highlight in lines that start with '>>>' (match lines)
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const lineText = line.text;
        
        // Check if this is a match line (starts with '>>>')
        if (lineText.startsWith('>>>')) {
            // Find the content part (after filename:linenumber:)
            const lastColonIndex = lineText.lastIndexOf(':');
            if (lastColonIndex >= 0) {
                const contentStart = lastColonIndex + 1;
                const content = lineText.substring(contentStart);
                
                // Find matches in the content
                let match;
                regex.lastIndex = 0; // Reset regex
                while ((match = regex.exec(content)) !== null) {
                    const startChar = contentStart + match.index;
                    const endChar = contentStart + match.index + match[0].length;
                    
                    decorations.push({
                        range: new vscode.Range(lineIndex, startChar, lineIndex, endChar)
                    });
                    
                    // Prevent infinite loop on zero-length matches
                    if (match[0].length === 0) {
                        regex.lastIndex++;
                    }
                }
            }
        }
    }

    // Create decoration type
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        overviewRulerColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        overviewRulerLane: vscode.OverviewRulerLane.Center
    });

    editor.setDecorations(decorationType, decorations);

    // Store decoration type to clean up later (dispose after a delay to avoid memory leaks)
    setTimeout(() => {
        decorationType.dispose();
    }, 60000); // Dispose after 60 seconds
}

export function deactivate() {}
