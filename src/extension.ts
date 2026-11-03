import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('algolens.visualize', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('AlgoLens: Open a Python file first.');
            return;
        }

        const sourceCode = editor.document.getText();
        const panel = vscode.window.createWebviewPanel(
            'algoLensView',
            'AlgoLens: Interactive Chalkboard Trace',
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = getWebviewContent();

        const scriptPath = path.join(context.extensionPath, 'python_engine', 'main.py');
        const pyProcess = spawn('python', [scriptPath]);

        let rawOutput = '';
        let errorOutput = '';

        pyProcess.stdout.on('data', (data: any) => { rawOutput += data.toString(); });
        pyProcess.stderr.on('data', (data: any) => { errorOutput += data.toString(); });

        pyProcess.on('close', (code: number | null) => {
            if (code === 0 && rawOutput.trim()) {
                try {
                    const events = JSON.parse(rawOutput);
                    panel.webview.postMessage({
                        command: 'init',
                        events: events,
                        sourceCode: sourceCode
                    });
                } catch (e) {
                    vscode.window.showErrorMessage('AlgoLens: Could not parse execution trace output.');
                }
            } else {
                vscode.window.showErrorMessage(`AlgoLens: Execution failed. ${errorOutput}`);
            }
        });

        pyProcess.stdin.write(sourceCode);
        pyProcess.stdin.end();
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg-editor: var(--vscode-editor-background, #1e1e1e);
            --bg-panel: var(--vscode-editorWidget-background, #252526);
            --border: var(--vscode-widget-border, #333333);
            --text-main: var(--vscode-editor-foreground, #d4d4d4);
            --text-dim: var(--vscode-descriptionForeground, #858585);
            --code-font: var(--vscode-editor-font-family, 'Fira Code', 'Consolas', monospace);

            --accent-blue: #38bdf8;
            --accent-pink: #f43f5e;
            --accent-green: #10b981;
            --accent-amber: #f59e0b;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: var(--vscode-font-family, -apple-system, sans-serif);
            background: var(--bg-editor);
            color: var(--text-main);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        header {
            padding: 10px 18px;
            background: var(--bg-panel);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .title-group h2 {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-dim);
        }

        .step-counter {
            font-size: 13px;
            font-family: var(--code-font);
            font-weight: 600;
        }

        .controls { display: flex; gap: 8px; }

        button {
            background: var(--vscode-button-secondaryBackground, #3f3f46);
            color: var(--vscode-button-secondaryForeground, #ffffff);
            border: 1px solid var(--border);
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        }

        button:hover { background: var(--vscode-button-secondaryHoverBackground, #52525b); }
        button.primary {
            background: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #ffffff);
        }
        button.primary:hover { background: var(--vscode-button-hoverBackground, #0062a3); }

        .workspace {
            display: grid;
            grid-template-columns: 46% 54%;
            flex-grow: 1;
            height: calc(100vh - 56px);
        }

        .code-panel {
            border-right: 1px solid var(--border);
            background: var(--bg-editor);
            overflow-y: auto;
            font-family: var(--code-font);
            font-size: 13px;
            line-height: 22px;
        }

        .code-line {
            display: flex;
            padding: 0 8px;
            white-space: pre;
            position: relative;
        }

        .line-num {
            width: 32px;
            color: var(--text-dim);
            text-align: right;
            margin-right: 14px;
            user-select: none;
            opacity: 0.5;
        }

        .line-text { flex-grow: 1; }

        .code-line.active {
            background: rgba(56, 189, 248, 0.16);
            border-left: 3px solid var(--accent-blue);
        }

        .code-line.active::after {
            content: '◄ Executing';
            position: absolute;
            right: 12px;
            font-size: 11px;
            font-weight: bold;
            color: var(--accent-blue);
        }

        .chalkboard {
            display: flex;
            flex-direction: column;
            padding: 20px;
            gap: 16px;
            overflow-y: auto;
        }

        .teacher-note {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent-blue);
            padding: 14px;
            border-radius: 6px;
            transition: all 0.2s ease;
        }

        .teacher-note.mutate { border-left-color: var(--accent-pink); }

        .note-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-dim);
            margin-bottom: 6px;
        }

        .note-explanation {
            font-size: 13.5px;
            line-height: 1.5;
        }

        .memory-box {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
        }

        .section-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-dim);
            font-weight: 700;
            margin-bottom: 12px;
        }

        .var-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 10px;
        }

        .var-card {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border);
            padding: 10px;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .var-card.active-ptr {
            border-color: var(--accent-amber);
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
        }

        .var-name {
            font-size: 11px;
            color: var(--text-dim);
            font-family: var(--code-font);
        }

        .var-val {
            font-size: 16px;
            font-weight: bold;
            font-family: var(--code-font);
            margin-top: 4px;
            color: #fff;
        }

        .stage-box {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .cells-container {
            display: flex;
            gap: 14px;
            align-items: flex-end;
            padding: 16px 0;
            flex-wrap: wrap;
            justify-content: center;
        }

        .cell-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 58px;
        }

        .pointer-tag {
            font-family: var(--code-font);
            font-size: 11px;
            font-weight: bold;
            height: 28px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            color: var(--accent-amber);
            transition: all 0.2s ease;
        }

        .pointer-badge {
            background: rgba(245, 158, 11, 0.2);
            border: 1px solid var(--accent-amber);
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 10px;
        }

        .cell-box {
            width: 54px;
            height: 54px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid var(--border);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
            font-family: var(--code-font);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cell-box.pointer-active {
            border-color: var(--accent-blue);
            background: rgba(56, 189, 248, 0.15);
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
        }

        .cell-box.mutate-active {
            border-color: var(--accent-pink);
            background: rgba(244, 63, 94, 0.25);
            transform: scale(1.08) translateY(-4px);
            box-shadow: 0 4px 16px rgba(244, 63, 94, 0.4);
        }

        .cell-index {
            margin-top: 8px;
            font-size: 11px;
            color: var(--text-dim);
            font-family: var(--code-font);
        }
    </style>
</head>
<body>

    <header>
        <div class="title-group">
            <h2>Algorithm Chalkboard Trace</h2>
            <div class="step-counter" id="step-info">Step: 0 / 0</div>
        </div>
        <div class="controls">
            <button id="btn-prev">◄ Prev</button>
            <button id="btn-next" class="primary">Next Step ►</button>
            <button id="btn-reset">Reset</button>
        </div>
    </header>

    <div class="workspace">
        <div class="code-panel" id="code-container"></div>

        <div class="chalkboard">
            <div class="teacher-note" id="teacher-card">
                <div class="note-title" id="note-type">TEACHER OBSERVATION</div>
                <div class="note-explanation" id="note-text">Initializing chalkboard...</div>
            </div>

            <div class="memory-box">
                <div class="section-label">Active Stack Frame / Variables</div>
                <div class="var-grid" id="var-grid"></div>
            </div>

            <div class="stage-box">
                <div class="section-label" id="array-label">Memory Array Layout</div>
                <div class="cells-container" id="cells-container"></div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let events = [];
        let sourceLines = [];
        let index = 0;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'init') {
                events = message.events;
                sourceLines = message.sourceCode.split(/\\r?\\n/);
                index = 0;
                renderSourceCode();
                render();
            }
        });

        function renderSourceCode() {
            const container = document.getElementById('code-container');
            container.innerHTML = '';
            sourceLines.forEach((text, i) => {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'code-line';
                lineDiv.id = 'src-line-' + (i + 1);

                const numSpan = document.createElement('span');
                numSpan.className = 'line-num';
                numSpan.innerText = (i + 1);

                const codeSpan = document.createElement('span');
                codeSpan.className = 'line-text';
                codeSpan.textContent = text;

                lineDiv.appendChild(numSpan);
                lineDiv.appendChild(codeSpan);
                container.appendChild(lineDiv);
            });
        }

        function render() {
            if (!events || events.length === 0) return;
            const curr = events[index];

            // 1. Step Counter
            document.getElementById('step-info').innerText = 'Step: ' + (index + 1) + ' / ' + events.length;

            // 2. Synchronize Line Highlight
            document.querySelectorAll('.code-line').forEach(el => el.classList.remove('active'));
            if (curr.line) {
                const targetLine = document.getElementById('src-line-' + curr.line);
                if (targetLine) {
                    targetLine.classList.add('active');
                    targetLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }

            // 3. Dynamic Variable Inspection Panel
            const varGrid = document.getElementById('var-grid');
            varGrid.innerHTML = '';
            const locals = curr.locals || {};

            for (const [key, val] of Object.entries(locals)) {
                if (key === curr.array_name) continue; // Don't duplicate the full array in cards

                const card = document.createElement('div');
                card.className = 'var-card';
                if (curr.pointers && curr.pointers[key] !== undefined) {
                    card.classList.add('active-ptr');
                }

                const formattedVal = typeof val === 'object' ? JSON.stringify(val) : val;
                card.innerHTML = '<div class="var-name">' + key + '</div><div class="var-val">' + formattedVal + '</div>';
                varGrid.appendChild(card);
            }

            // 4. Blackboard Explanation
            const noteCard = document.getElementById('teacher-card');
            const noteType = document.getElementById('note-type');
            const noteText = document.getElementById('note-text');

            if (curr.action === 'MUTATE') {
                noteCard.className = 'teacher-note mutate';
                noteType.innerText = 'STATE MUTATION (WRITE / SWAP)';
                noteText.innerHTML = 'Index ' + JSON.stringify(curr.changed_indices) + ' modified in <code>' + (curr.array_name || 'arr') + '</code>. Array updated to reflect assignments.';
            } else {
                noteCard.className = 'teacher-note';
                noteType.innerText = 'EXECUTION OBSERVATION';
                const ptrPairs = Object.entries(curr.pointers || {}).map(([k, v]) => '<code>' + k + '=' + v + '</code>').join(', ');
                noteText.innerHTML = 'Executing line <strong>' + curr.line + '</strong>. Active loop pointers: ' + (ptrPairs || 'None');
            }

            // 5. Memory Array Stage with Overhead Pointers
            const container = document.getElementById('cells-container');
            container.innerHTML = '';
            document.getElementById('array-label').innerText = 'Memory Array Layout (' + (curr.array_name || 'arr') + ')';

            if (curr.array && Array.isArray(curr.array)) {
                curr.array.forEach((val, idx) => {
                    const col = document.createElement('div');
                    col.className = 'cell-column';

                    // Overhead Pointer Marker
                    const pointerDiv = document.createElement('div');
                    pointerDiv.className = 'pointer-tag';

                    const matchingPointers = [];
                    for (const [pName, pIdx] of Object.entries(curr.pointers || {})) {
                        if (pIdx === idx) matchingPointers.push(pName);
                    }

                    if (matchingPointers.length > 0) {
                        pointerDiv.innerHTML = '<span class="pointer-badge">' + matchingPointers.join(', ') + '</span><span>▼</span>';
                    }
                    col.appendChild(pointerDiv);

                    // Array Block
                    const box = document.createElement('div');
                    box.className = 'cell-box';
                    box.innerText = val;

                    if (curr.changed_indices && curr.changed_indices.includes(idx)) {
                        box.classList.add('mutate-active');
                    } else if (matchingPointers.length > 0) {
                        box.classList.add('pointer-active');
                    }
                    col.appendChild(box);

                    // Index Marker
                    const idxLabel = document.createElement('div');
                    idxLabel.className = 'cell-index';
                    idxLabel.innerText = '[' + idx + ']';
                    col.appendChild(idxLabel);

                    container.appendChild(col);
                });
            }
        }

        document.getElementById('btn-next').onclick = () => {
            if (index < events.length - 1) { index++; render(); }
        };
        document.getElementById('btn-prev').onclick = () => {
            if (index > 0) { index--; render(); }
        };
        document.getElementById('btn-reset').onclick = () => {
            index = 0; render();
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') document.getElementById('btn-next').click();
            if (e.key === 'ArrowLeft') document.getElementById('btn-prev').click();
        });
    </script>
</body>
</html>`;
}