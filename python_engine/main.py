import sys
import json
import ast
import copy
import inspect
from collections import deque

class ExecutionTracer:
    def __init__(self, target_func_name):
        self.target_func_name = target_func_name
        self.events = []
        self.step_count = 1
        self.prev_locals = {}

    def trace_calls(self, frame, event, arg):
        if frame.f_code.co_name == self.target_func_name:
            return self.trace_lines
        return None

    def trace_lines(self, frame, event, arg):
        if event != 'line':
            return self.trace_lines

        line = frame.f_lineno
        raw_locals = frame.f_locals

        # Extract JSON-serializable primitives and collections
        current_locals = {}
        for k, v in raw_locals.items():
            if k.startswith('__'):
                continue
            if isinstance(v, (int, float, str, bool)):
                current_locals[k] = v
            elif isinstance(v, list):
                current_locals[k] = copy.deepcopy(v)
            elif isinstance(v, (set, tuple, deque)):
                # Convert deques, sets, and tuples into lists so they serialize cleanly
                current_locals[k] = list(copy.deepcopy(v))
            elif isinstance(v, dict):
                current_locals[k] = copy.deepcopy(v)

        # 1. Detect Array (for Sorting algorithms)
        primary_arr_name = None
        primary_arr = None
        for k, v in current_locals.items():
            if isinstance(v, list) and (len(v) == 0 or isinstance(v[0], (int, float))):
                primary_arr_name = k
                primary_arr = v
                break

        # Detect index pointers (integers that index into primary_arr)
        pointers = {}
        if primary_arr is not None and len(primary_arr) > 0:
            for k, v in current_locals.items():
                if isinstance(v, int) and 0 <= v < len(primary_arr):
                    pointers[k] = v

        # Detect array mutations
        changed_indices = []
        action = "STEP"
        if primary_arr_name and primary_arr_name in self.prev_locals:
            prev_arr = self.prev_locals[primary_arr_name]
            if isinstance(prev_arr, list) and len(prev_arr) == len(primary_arr):
                for idx in range(len(primary_arr)):
                    if primary_arr[idx] != prev_arr[idx]:
                        changed_indices.append(idx)
                if changed_indices:
                    action = "MUTATE"

        # 2. Detect Graph & Traversal Structures (for BFS/DFS)
        graph_dict = None
        queue_list = None
        visited_list = None
        current_node = current_locals.get("node", current_locals.get("curr", current_locals.get("vertex", None)))

        for k, v in current_locals.items():
            if isinstance(v, dict) and any(isinstance(val, list) for val in v.values()):
                graph_dict = v
            elif isinstance(v, list) and k in ["queue", "q"]:
                queue_list = v
            elif isinstance(v, list) and k in ["visited", "seen"]:
                visited_list = v

        is_bfs = graph_dict is not None or queue_list is not None

        self.events.append({
            "step": self.step_count,
            "line": line,
            "action": action,
            "is_graph": is_bfs,
            "locals": current_locals,
            "array_name": primary_arr_name,
            "array": primary_arr,
            "pointers": pointers,
            "changed_indices": changed_indices,
            "graph": graph_dict,
            "queue": queue_list,
            "visited": visited_list,
            "current_node": current_node
        })

        self.step_count += 1
        self.prev_locals = copy.deepcopy(current_locals)
        return self.trace_lines

def main():
    source_code = sys.stdin.read()
    if not source_code.strip():
        print(json.dumps([]))
        return

    try:
        ast.parse(source_code)
    except SyntaxError:
        print(json.dumps([]))
        return

    env = {}
    try:
        exec(source_code, env)
    except Exception:
        print(json.dumps([]))
        return

    # Locate user-defined function
    target_func = None
    for k, v in env.items():
        if callable(v) and not k.startswith("__") and inspect.isfunction(v):
            target_func = v

    if not target_func:
        print(json.dumps([]))
        return

    tracer = ExecutionTracer(target_func.__name__)
    sys.settrace(tracer.trace_calls)

    # Dynamic Test Fixture Injection
    sig = inspect.signature(target_func)
    params = list(sig.parameters.keys())

    test_graph = {
        'A': ['B', 'C'],
        'B': ['A', 'D', 'E'],
        'C': ['A', 'F'],
        'D': ['B'],
        'E': ['B', 'F'],
        'F': ['C', 'E']
    }
    test_array = [5, 2, 8, 1, 4]

    try:
        # Determine whether function expects graph adjacency or array
        if any(p in ['graph', 'adj', 'adj_list', 'tree'] for p in params):
            if len(params) >= 2:
                target_func(test_graph, 'A')
            else:
                target_func(test_graph)
        else:
            target_func(test_array)
    except Exception as e:
        # Useful for debugging if an unexpected error occurs during call
        sys.stderr.write(str(e))
    finally:
        sys.settrace(None)

    print(json.dumps(tracer.events))

if __name__ == "__main__":
    main()