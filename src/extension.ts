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
            --accent-purple: #a855f7;
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

        .teacher-note.bfs { border-left-color: var(--accent-purple); }
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
            font-size: 15px;
            font-weight: bold;
            font-family: var(--code-font);
            margin-top: 4px;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Stages */
        .stage-box {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px 16px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        /* Sorting Array Stage */
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
            transition: all 0.25s ease;
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

        /* BFS Graph & Queue Visuals */
        .queue-strip {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px 14px;
            font-family: var(--code-font);
            margin-bottom: 8px;
        }

        .queue-label {
            font-size: 11px;
            font-weight: bold;
            color: var(--accent-purple);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-right: 6px;
        }

        .queue-item {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: rgba(168, 85, 247, 0.2);
            border: 1.5px solid var(--accent-purple);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
        }

        .queue-empty {
            font-size: 12px;
            color: var(--text-dim);
            font-style: italic;
        }

        .tree-container {
            width: 100%;
            height: 250px;
            position: relative;
        }

        svg.graph-svg {
            width: 100%;
            height: 100%;
        }

        .graph-edge {
            stroke: var(--border);
            stroke-width: 2px;
            transition: stroke 0.3s ease;
        }

        .graph-edge.active {
            stroke: var(--accent-purple);
            stroke-width: 3px;
        }

        .graph-node-circle {
            fill: var(--bg-panel);
            stroke: var(--border);
            stroke-width: 2.5px;
            transition: all 0.3s ease;
        }

        .graph-node-circle.current {
            fill: rgba(168, 85, 247, 0.35);
            stroke: var(--accent-purple);
            stroke-width: 4px;
            filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.7));
        }

        .graph-node-circle.neighbor {
            fill: rgba(56, 189, 248, 0.2);
            stroke: var(--accent-blue);
            stroke-width: 3px;
            filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.5));
        }

        .graph-node-circle.visited {
            fill: rgba(16, 185, 129, 0.2);
            stroke: var(--accent-green);
        }

        .graph-node-text {
            fill: var(--text-main);
            font-family: var(--code-font);
            font-size: 14px;
            font-weight: bold;
            text-anchor: middle;
            dominant-baseline: central;
            pointer-events: none;
        }
    </style>
</head>
<body>

    <header>
        <div class="title-group">
            <h2 id="header-algo-name">AlgoLens Chalkboard Trace</h2>
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
                <div class="note-explanation" id="note-text">Initializing visual trace...</div>
            </div>

            <div class="memory-box">
                <div class="section-label">Active Stack Frame / Variables</div>
                <div class="var-grid" id="var-grid"></div>
            </div>

            <div class="stage-box" id="stage-box">
                <div class="section-label" id="stage-label">Visual Stage</div>
                <div id="dynamic-stage"></div>
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
            document.getElementById('header-algo-name').innerText = curr.is_graph ? 'BFS Graph Traversal' : 'Sorting Algorithm';

            // 2. Synchronize Line Highlight
            document.querySelectorAll('.code-line').forEach(el => el.classList.remove('active'));
            if (curr.line) {
                const targetLine = document.getElementById('src-line-' + curr.line);
                if (targetLine) {
                    targetLine.classList.add('active');
                    targetLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }

            // 3. Render Variable Stack Frame
            const varGrid = document.getElementById('var-grid');
            varGrid.innerHTML = '';
            const locals = curr.locals || {};

            for (const [key, val] of Object.entries(locals)) {
                // Skip rendering entire graph dict or full primary array in the tiny variable cards
                if (key === curr.array_name || (typeof val === 'object' && val !== null && !Array.isArray(val))) {
                    continue;
                }

                const card = document.createElement('div');
                card.className = 'var-card';
                if (curr.pointers && curr.pointers[key] !== undefined) {
                    card.classList.add('active-ptr');
                }

                const formattedVal = typeof val === 'object' ? JSON.stringify(val) : val;
                card.innerHTML = '<div class="var-name">' + key + '</div><div class="var-val" title="' + formattedVal + '">' + formattedVal + '</div>';
                varGrid.appendChild(card);
            }

            // 4. Blackboard Explanation
            const noteCard = document.getElementById('teacher-card');
            const noteType = document.getElementById('note-type');
            const noteText = document.getElementById('note-text');

            if (curr.is_graph) {
                noteCard.className = 'teacher-note bfs';
                noteType.innerText = 'BREADTH-FIRST SEARCH STEP';
                const nodeVal = locals['node'] !== undefined ? locals['node'] : '-';
                const neighborVal = locals['neighbor'] !== undefined ? locals['neighbor'] : null;

                if (neighborVal !== null) {
                    noteText.innerHTML = 'Inspecting adjacent neighbor <code>' + neighborVal + '</code> connected to current node <code>' + nodeVal + '</code>.';
                } else if (nodeVal !== '-') {
                    noteText.innerHTML = 'Popped node <code>' + nodeVal + '</code> from front of queue to explore its adjacent vertices.';
                } else {
                    noteText.innerHTML = 'Queue and tracking structures initialized. Starting traversal from root.';
                }
            } else {
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
            }

            // 5. Render Visual Stage (Sorting vs BFS)
            const dynamicStage = document.getElementById('dynamic-stage');
            const stageLabel = document.getElementById('stage-label');
            dynamicStage.innerHTML = '';

            if (curr.is_graph) {
                stageLabel.innerText = 'Graph Structure & BFS Execution Stage';

                // A. Visual FIFO Queue Bar
                const queueBox = document.createElement('div');
                queueBox.className = 'queue-strip';
                queueBox.innerHTML = '<span class="queue-label">FIFO Queue (Front ➔ Rear):</span>';

                const queueArr = curr.queue || locals['queue'] || [];
                if (queueArr.length === 0) {
                    queueBox.innerHTML += '<span class="queue-empty">Queue is empty</span>';
                } else {
                    queueArr.forEach(item => {
                        const qItem = document.createElement('div');
                        qItem.className = 'queue-item';
                        qItem.innerText = item;
                        queueBox.appendChild(qItem);
                    });
                }
                dynamicStage.appendChild(queueBox);

                // B. Visual SVG Tree/Graph Canvas
                const treeContainer = document.createElement('div');
                treeContainer.className = 'tree-container';

                const svgNS = "http://www.w3.org/2000/svg";
                const svg = document.createElementNS(svgNS, "svg");
                svg.setAttribute('class', 'graph-svg');
                svg.setAttribute('viewBox', '0 0 460 220');

                // Standard Tree coordinates (A at top, B & C middle, D E F bottom)
                const nodePositions = {
                    'A': { x: 230, y: 35 },
                    'B': { x: 130, y: 105 },
                    'C': { x: 330, y: 105 },
                    'D': { x: 75,  y: 175 },
                    'E': { x: 185, y: 175 },
                    'F': { x: 385, y: 175 }
                };

                const graphData = curr.graph || {
                    'A': ['B', 'C'],
                    'B': ['A', 'D', 'E'],
                    'C': ['A', 'F'],
                    'D': ['B'],
                    'E': ['B', 'F'],
                    'F': ['C', 'E']
                };

                const currentNode = locals['node'];
                const neighborNode = locals['neighbor'];
                const visitedNodes = curr.visited || locals['visited'] || [];

                // Draw Edges
                const drawnEdges = new Set();
                for (const [u, neighbors] of Object.entries(graphData)) {
                    if (!nodePositions[u]) continue;
                    (neighbors || []).forEach(v => {
                        if (!nodePositions[v]) return;
                        const edgeKey = [u, v].sort().join('-');
                        if (drawnEdges.has(edgeKey)) return;
                        drawnEdges.add(edgeKey);

                        const line = document.createElementNS(svgNS, 'line');
                        line.setAttribute('x1', nodePositions[u].x);
                        line.setAttribute('y1', nodePositions[u].y);
                        line.setAttribute('x2', nodePositions[v].x);
                        line.setAttribute('y2', nodePositions[v].y);
                        line.setAttribute('class', 'graph-edge');

                        if ((u === currentNode && v === neighborNode) || (v === currentNode && u === neighborNode)) {
                            line.classList.add('active');
                        }
                        svg.appendChild(line);
                    });
                }

                // Draw Node Circles and Labels
                for (const [nodeId, pos] of Object.entries(nodePositions)) {
                    const group = document.createElementNS(svgNS, 'g');

                    const circle = document.createElementNS(svgNS, 'circle');
                    circle.setAttribute('cx', pos.x);
                    circle.setAttribute('cy', pos.y);
                    circle.setAttribute('r', 19);
                    circle.setAttribute('class', 'graph-node-circle');

                    if (nodeId === currentNode) {
                        circle.classList.add('current');
                    } else if (nodeId === neighborNode) {
                        circle.classList.add('neighbor');
                    } else if (visitedNodes.includes(nodeId)) {
                        circle.classList.add('visited');
                    }

                    const text = document.createElementNS(svgNS, 'text');
                    text.setAttribute('x', pos.x);
                    text.setAttribute('y', pos.y);
                    text.setAttribute('class', 'graph-node-text');
                    text.textContent = nodeId;

                    group.appendChild(circle);
                    group.appendChild(text);
                    svg.appendChild(group);
                }

                treeContainer.appendChild(svg);
                dynamicStage.appendChild(treeContainer);

            } else {
                // Sorting Array Stage
                stageLabel.innerText = 'Memory Array Layout (' + (curr.array_name || 'arr') + ')';
                const container = document.createElement('div');
                container.className = 'cells-container';

                if (curr.array && Array.isArray(curr.array)) {
                    curr.array.forEach((val, idx) => {
                        const col = document.createElement('div');
                        col.className = 'cell-column';

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

                        const box = document.createElement('div');
                        box.className = 'cell-box';
                        box.innerText = val;

                        if (curr.changed_indices && curr.changed_indices.includes(idx)) {
                            box.classList.add('mutate-active');
                        } else if (matchingPointers.length > 0) {
                            box.classList.add('pointer-active');
                        }
                        col.appendChild(box);

                        const idxLabel = document.createElement('div');
                        idxLabel.className = 'cell-index';
                        idxLabel.innerText = '[' + idx + ']';
                        col.appendChild(idxLabel);

                        container.appendChild(col);
                    });
                }
                dynamicStage.appendChild(container);
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