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

        // Execute Python tracer
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

            --accent-compare: #38bdf8;
            --accent-swap: #f43f5e;
            --accent-sorted: #10b981;
            --highlight-line: rgba(56, 189, 248, 0.15);
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

        /* Top Bar Controls */
        header {
            padding: 12px 20px;
            background: var(--bg-panel);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .title-group h2 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-dim);
        }

        .step-counter {
            font-size: 13px;
            font-family: var(--code-font);
            font-weight: 600;
        }

        .controls {
            display: flex;
            gap: 8px;
        }

        button {
            background: var(--vscode-button-secondaryBackground, #3f3f46);
            color: var(--vscode-button-secondaryForeground, #ffffff);
            border: 1px solid var(--border);
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        button:hover { background: var(--vscode-button-secondaryHoverBackground, #52525b); }
        button.primary {
            background: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #ffffff);
        }
        button.primary:hover { background: var(--vscode-button-hoverBackground, #0062a3); }

        /* Main Workspace Split */
        .workspace {
            display: grid;
            grid-template-columns: 42% 58%;
            flex-grow: 1;
            height: calc(100vh - 58px);
        }

        /* Code Viewer Panel */
        .code-panel {
            border-right: 1px solid var(--border);
            background: var(--bg-editor);
            overflow-y: auto;
            font-family: var(--code-font);
            font-size: 12.5px;
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
            margin-right: 16px;
            user-select: none;
            opacity: 0.6;
        }

        .line-text { flex-grow: 1; }

        .code-line.active {
            background: var(--highlight-line);
            border-left: 3px solid var(--accent-compare);
        }

        .code-line.active::after {
            content: '◄ Executing';
            position: absolute;
            right: 12px;
            font-size: 11px;
            font-weight: bold;
            color: var(--accent-compare);
            opacity: 0.85;
        }

        /* Right Side: Blackboard & Memory */
        .chalkboard {
            display: flex;
            flex-direction: column;
            padding: 24px;
            gap: 20px;
            overflow-y: auto;
            background: radial-gradient(circle at top right, rgba(255,255,255,0.02), transparent);
        }

        /* Blackboard Note / Teacher Explanation */
        .teacher-note {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent-compare);
            padding: 16px;
            border-radius: 6px;
        }

        .teacher-note.swap {
            border-left-color: var(--accent-swap);
        }

        .note-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-dim);
            margin-bottom: 6px;
        }

        .note-explanation {
            font-size: 14px;
            line-height: 1.4;
        }

        /* Variable Memory Box (Stack Frame simulation) */
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
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 12px;
        }

        .var-card {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border);
            padding: 8px 12px;
            border-radius: 6px;
        }

        .var-name {
            font-size: 11px;
            color: var(--text-dim);
            font-family: var(--code-font);
        }

        .var-val {
            font-size: 18px;
            font-weight: bold;
            font-family: var(--code-font);
            margin-top: 4px;
        }

        /* Array Trace & Pointers */
        .array-stage {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
        }

        .cells-container {
            display: flex;
            gap: 14px;
            align-items: flex-end;
            padding: 10px 0;
        }

        .cell-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 58px;
            position: relative;
        }

        .pointer-tag {
            font-family: var(--code-font);
            font-size: 11px;
            font-weight: bold;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent-compare);
            transition: all 0.2s ease;
        }

        .pointer-arrow {
            font-size: 12px;
            line-height: 1;
            margin-bottom: 2px;
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
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cell-index {
            margin-top: 8px;
            font-size: 11px;
            color: var(--text-dim);
            font-family: var(--code-font);
        }

        /* Pointer & State Modifiers */
        .cell-box.comparing {
            border-color: var(--accent-compare);
            background: rgba(56, 189, 248, 0.15);
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(56, 189, 248, 0.25);
        }

        .cell-box.swapping {
            border-color: var(--accent-swap);
            background: rgba(244, 63, 94, 0.2);
            transform: scale(1.08) translateY(-4px);
            box-shadow: 0 4px 16px rgba(244, 63, 94, 0.35);
        }
    </style>
</head>
<body>

    <header>
        <div class="title-group">
            <h2>Algorithm Chalkboard</h2>
            <div class="step-counter" id="step-info">Step: 0 / 0</div>
        </div>
        <div class="controls">
            <button id="btn-prev">◄ Prev</button>
            <button id="btn-next" class="primary">Next Step ►</button>
            <button id="btn-reset">Reset</button>
        </div>
    </header>

    <div class="workspace">
        <!-- Panel 1: Original Code -->
        <div class="code-panel" id="code-container">
            <!-- Rendered line-by-line via JavaScript -->
        </div>

        <!-- Panel 2: Notebook Breakdown -->
        <div class="chalkboard">
            <!-- Dynamic Teacher Explanation -->
            <div class="teacher-note" id="teacher-card">
                <div class="note-title" id="note-type">OBSERVATION</div>
                <div class="note-explanation" id="note-text">Initializing visual trace...</div>
            </div>

            <!-- Memory Watch Box -->
            <div class="memory-box">
                <div class="section-label">Active Stack Frame / Variables</div>
                <div class="var-grid" id="var-grid">
                    <!-- Dynamic variables inserted here -->
                </div>
            </div>

            <!-- Detailed Visual Array Stage -->
            <div class="array-stage">
                <div class="section-label" style="align-self: flex-start;">Memory Array Layout (arr)</div>
                <div class="cells-container" id="cells-container">
                    <!-- Dynamic Array Nodes with Pointers -->
                </div>
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

            // 1. Update Step Counter
            document.getElementById('step-info').innerText = 'Step: ' + (index + 1) + ' / ' + events.length;

            // 2. Synchronize Line Highlight in Code Viewer
            document.querySelectorAll('.code-line').forEach(el => el.classList.remove('active'));
            if (curr.line) {
                const targetLine = document.getElementById('src-line-' + curr.line);
                if (targetLine) {
                    targetLine.classList.add('active');
                    targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // 3. Extract Variables (Pointers and Values)
            const idx1 = (curr.indices && curr.indices.length > 0) ? curr.indices[0] : null;
            const idx2 = (curr.indices && curr.indices.length > 1) ? curr.indices[1] : null;
            const val1 = idx1 !== null ? curr.array[idx1] : null;
            const val2 = idx2 !== null ? curr.array[idx2] : null;

            // 4. Blackboard Teacher Explanation
            const noteCard = document.getElementById('teacher-card');
            const noteType = document.getElementById('note-type');
            const noteText = document.getElementById('note-text');

            if (curr.type === 'COMPARE') {
                noteCard.className = 'teacher-note';
                noteType.innerText = 'COMPARISON CHECK';
                noteText.innerHTML = 'Examining adjacent elements at index <code>j=' + idx1 + '</code> (value <strong>' + val1 + '</strong>) and <code>j+1=' + idx2 + '</code> (value <strong>' + val2 + '</strong>). ' +
                    (val1 > val2 ? 'Since <strong>' + val1 + ' &gt; ' + val2 + '</strong>, order is incorrect; a swap will follow.' : 'Since <strong>' + val1 + ' &le; ' + val2 + '</strong>, these elements are currently ordered.');
            } else if (curr.type === 'SWAP') {
                noteCard.className = 'teacher-note swap';
                noteType.innerText = 'STATE MUTATION (SWAP)';
                noteText.innerHTML = 'Exchanged positions between elements at index <code>' + idx1 + '</code> and <code>' + idx2 + '</code>. The larger value propagates towards the end of the collection.';
            } else {
                noteCard.className = 'teacher-note';
                noteType.innerText = 'TRACE';
                noteText.innerText = 'Stepping through code execution.';
            }

            // 5. Variable Watch Grid
            const varGrid = document.getElementById('var-grid');
            varGrid.innerHTML = '';

            const activeVars = [
                { name: 'j (current)', val: idx1 !== null ? idx1 : '-' },
                { name: 'j + 1 (adjacent)', val: idx2 !== null ? idx2 : '-' },
                { name: 'arr[j]', val: val1 !== null ? val1 : '-' },
                { name: 'arr[j+1]', val: val2 !== null ? val2 : '-' },
                { name: 'len(arr)', val: curr.array.length }
            ];

            activeVars.forEach(v => {
                const card = document.createElement('div');
                card.className = 'var-card';
                card.innerHTML = '<div class="var-name">' + v.name + '</div><div class="var-val">' + v.val + '</div>';
                varGrid.appendChild(card);
            });

            // 6. Detailed Interactive Array Stage with Overhead Pointers
            const cellsContainer = document.getElementById('cells-container');
            cellsContainer.innerHTML = '';

            curr.array.forEach((num, idx) => {
                const col = document.createElement('div');
                col.className = 'cell-column';

                // Overhead Pointer Marker
                const pointer = document.createElement('div');
                pointer.className = 'pointer-tag';
                if (idx === idx1) {
                    pointer.innerHTML = '<div style="text-align:center;"><div class="pointer-arrow">▼</div>j</div>';
                } else if (idx === idx2) {
                    pointer.innerHTML = '<div style="text-align:center;"><div class="pointer-arrow">▼</div>j+1</div>';
                }
                col.appendChild(pointer);

                // Array Cell Element
                const box = document.createElement('div');
                box.className = 'cell-box';
                box.innerText = num;

                if (curr.indices && curr.indices.includes(idx)) {
                    box.classList.add(curr.type === 'SWAP' ? 'swapping' : 'comparing');
                }
                col.appendChild(box);

                // Index indicator
                const idxLabel = document.createElement('div');
                idxLabel.className = 'cell-index';
                idxLabel.innerText = '[' + idx + ']';
                col.appendChild(idxLabel);

                cellsContainer.appendChild(col);
            });
        }

        // Stepping Controls
        document.getElementById('btn-next').onclick = () => {
            if (index < events.length - 1) {
                index++;
                render();
            }
        };

        document.getElementById('btn-prev').onclick = () => {
            if (index > 0) {
                index--;
                render();
            }
        };

        document.getElementById('btn-reset').onclick = () => {
            index = 0;
            render();
        };

        // Keyboard Shortcut Stepping (Arrow keys)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') document.getElementById('btn-next').click();
            if (e.key === 'ArrowLeft') document.getElementById('btn-prev').click();
        });
    </script>
</body>
</html>`;
}