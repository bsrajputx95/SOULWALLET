import sys
import os

def print_tree(paths):
    tree = {}
    for path in paths:
        parts = path.strip().split('/')
        current = tree
        for part in parts:
            current = current.setdefault(part, {})

    def print_node(node, prefix=''):
        items = list(node.keys())
        # Sort directories first, then files? Or alphabetical?
        # Standard tree sorts alphabetical.
        items.sort()
        
        for i, item in enumerate(items):
            is_last = (i == len(items) - 1)
            connector = '└── ' if is_last else '├── '
            print(f"{prefix}{connector}{item}")
            new_prefix = prefix + ('    ' if is_last else '│   ')
            if node[item]:
                print_node(node[item], new_prefix)

    print_node(tree)

try:
    with open('file_structure_temp.txt', 'r', encoding='utf-8') as f:
        paths = [line.strip() for line in f if line.strip()]
    print_tree(paths)
except Exception as e:
    print(f"Error: {e}")
