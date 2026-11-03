# Mayur Patel's AlgoLens 🔍

**AlgoLens** is an interactive execution tracer and visual algorithm chalkboard for Visual Studio Code[cite: 5].

Instead of staring at terminal print statements or setting breakpoints in a debugger, AlgoLens turns your Python code into an interactive, side-by-side walkthrough that visually illustrates what the algorithm is doing at each step.

---

## Visual Previews

### 1. Array & Sorting Visualization (Insertion Sort, Bubble Sort)
Track pointers (`i`, `j`), in-flight values (`key`), and watch memory updates pulse in red as shifts or swaps occur[cite: 10].

![Insertion Sort Trace](https://github.com/mayurpatel78645/algolens_v2/main/images/insertion_sort_demo.png)

- **Synchronized Line Highlighting**: Follows source code execution line by line.
- **Dynamic Pointer Indicators**: Overhead tags hover directly above active index positions.
- **State Mutation Alerts**: Explains assignments and shifts in plain English.

---

### 2. Graph & Tree Traversal (Breadth-First Search)
Watch nodes light up as they are visited and observe elements entering and leaving the internal queue in real time.

![BFS Graph Traversal Trace](https://github.com/mayurpatel78645/algolens_v2/main/images/bfs_graph_demo.png)

- **Interactive Node States**: Nodes change state visually between current (purple glow), neighbor under evaluation (blue glow), and visited (green).
- **FIFO Queue Strip**: Displays elements entering and leaving `collections.deque` (`Front ➔ Rear`).
- **Pedagogical Observations**: Details every queue pop and adjacency inspection.

---

## Getting Started

### Prerequisites
- **Visual Studio Code** (`v1.85.0` or higher)[cite: 5]
- **Python 3** installed and accessible on your system `PATH`

### How to Use

1. Open a `.py` file containing an algorithm function (e.g., `bubble_sort`, `insertion_sort`, or `bfs`)[cite: 10].
2. Open the Command Palette[cite: 9]:
   - **Windows / Linux:** `Ctrl + Shift + P`[cite: 9]
   - **macOS:** `Cmd + Shift + P`
3. Type and select[cite: 9]:
   ```text
   AlgoLens: Visualize Algorithm
   ```[cite: 5, 9]
4. A split-screen chalkboard will open alongside your code.
5. Step through execution using:
   - The **Next Step ►** and **◄ Prev** buttons at the top right.
   - The **Left Arrow (←)** and **Right Arrow (→)** keys on your keyboard.
   - The **Reset** button to start over from Step 1.

---

## Supported Algorithms (v0.1.1)

- **Bubble Sort** (adjacent comparisons, swap animations, index pointer flags)[cite: 10]
- **Insertion Sort** (key extraction, shifting elements, insertion placement)[cite: 10]
- **Breadth-First Search (BFS)** (interactive tree/graph canvas, queue pipeline visualization, adjacency traversal)

---

## Current Limitations

Because this is an early release (v0.1.x), please note:

- **Single Function Scope**: AlgoLens analyzes the primary algorithm function defined in your active file. Complex nested helper functions or multi-class setups are not yet traced.
- **Fixed Traversal Topologies**: For BFS, the engine provides a connected fixture (`A` through `F`) to ensure clean SVG canvas placement. Arbitrary external topologies are currently mapped to the standard stage.
- **Standard Library Only**: The execution engine relies on Python's built-in modules (`ast`, `sys.settrace`, `collections`, `inspect`). External dependencies like NumPy arrays or Pandas DataFrames are not supported in this release.

---

## Roadmap

- [ ] **Depth-First Search (DFS)** with a visual **LIFO Call Stack**.
- [ ] **Binary Search** with low / mid / high pointer windows.
- [ ] **Custom Input Prompt**: Pass custom arrays or graph structures directly from the UI.
- [ ] **Merge Sort & Quick Sort** recursive split/merge visualizer.
- [ ] **Speed Slider & Auto-Play**.

---

## Feedback & Reviews

AlgoLens is actively maintained and designed to make data structures and algorithms intuitive. 

If you encounter an issue, have ideas for improvement, or want to see a specific algorithm added, please consider leaving a review on the VS Code Marketplace or opening an issue on GitHub!