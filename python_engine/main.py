import sys
import json
import ast
import copy

class BubbleSortAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.has_nested_loops = False
        self.has_adjacent_compare = False
        self.has_conditional_swap = False

    def visit_For(self, node):
        for child in node.body:
            if isinstance(child, ast.For):
                self.has_nested_loops = True
                self._analyze_inner(child)
        self.generic_visit(node)

    def _analyze_inner(self, node):
        for stmt in node.body:
            if isinstance(stmt, ast.If):
                if isinstance(stmt.test, ast.Compare):
                    self.has_adjacent_compare = True
                for s in stmt.body:
                    if isinstance(s, ast.Assign) and isinstance(s.targets[0], ast.Tuple):
                        self.has_conditional_swap = True

class AlgoTracer:
    def __init__(self, func_name):
        self.func_name = func_name
        self.events = []
        self.step = 1
        self.prev_state = None
        self.prev_line = None

    def trace_calls(self, frame, event, arg):
        if frame.f_code.co_name == self.func_name:
            return self.trace_lines
        return None

    def trace_lines(self, frame, event, arg):
        if event != 'line':
            return
        line = frame.f_lineno
        locals_ = frame.f_locals

        if 'arr' in locals_:
            current = copy.deepcopy(locals_['arr'])
            j = locals_.get('j', None)

            if self.prev_state is not None and self.prev_state != current:
                self.events.append({
                    "type": "SWAP",
                    "step": self.step,
                    "line": self.prev_line,
                    "array": current,
                    "indices": [j, j + 1] if j is not None else []
                })
                self.step += 1
            elif j is not None and j + 1 < len(current):
                self.events.append({
                    "type": "COMPARE",
                    "step": self.step,
                    "line": line,
                    "array": current,
                    "indices": [j, j + 1]
                })
                self.step += 1

            self.prev_state = current
        self.prev_line = line
        return self.trace_lines

def main():
    source_code = sys.stdin.read()
    if not source_code.strip():
        print(json.dumps([]))
        return

    # 1. Structural AST Recognition
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        print(json.dumps([]))
        return

    analyzer = BubbleSortAnalyzer()
    analyzer.visit(tree)

    # 2. Dynamic Execution & Tracing
    env = {}
    try:
        exec(source_code, env)
    except Exception:
        print(json.dumps([]))
        return

    target_func = env.get("bubble_sort")
    if not target_func:
        # Fallback: grab first user-defined function in scope
        for k, v in env.items():
            if callable(v) and not k.startswith("__"):
                target_func = v
                break

    if not target_func:
        print(json.dumps([]))
        return

    test_input = [5, 2, 8, 1, 4]
    tracer = AlgoTracer(target_func.__name__)
    sys.settrace(tracer.trace_calls)
    try:
        target_func(test_input)
    finally:
        sys.settrace(None)

    print(json.dumps(tracer.events))

if __name__ == "__main__":
    main()
