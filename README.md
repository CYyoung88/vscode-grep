# Grep Search Extension for VS Code

A VS Code extension that provides grep-like search functionality. Search within the currently active file using grep patterns and parameters.

## Features

- Search within the currently active file
- Support for standard grep parameters (`-i`, `-n`, `-v`, `-w`, `-A`, `-B`, `-C`, etc.)
- Display results in a new tab with syntax highlighting
- Context line support (`-A`, `-B`, `-C` parameters)

## Usage

1. Open a file in VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Grep" and select the command
4. Enter your search pattern and grep parameters (e.g., `-i -A 3 keyword`)
5. Results will be displayed in a new tab with highlighted matches

## Examples

- `keyword` - Search for "keyword"
- `-i keyword` - Case-insensitive search
- `-A 3 keyword` - Search with 3 lines after context
- `-B 2 keyword` - Search with 2 lines before context
- `-C 5 keyword` - Search with 5 lines context (before and after)
- `-n keyword` - Show line numbers (always enabled)

## Requirements

- VS Code 1.74.0 or higher

## License

MIT
