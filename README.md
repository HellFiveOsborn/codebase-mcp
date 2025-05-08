# Codebase MCP

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server implementation that provides tools to retrieve and analyze entire codebases using [RepoMix](https://repomix.com/).

This MCP allows AI Agents like Cursor's Composer Agent to automatically read and understand entire codebases at once, making it easier for developers to work with large codebases and for AI assistants to have comprehensive context of a project.

## Features

- 📚 **Codebase Retrieval**: Retrieve the entire codebase as a single text output in different formats (XML, Markdown, Plain)
- 🌐 **Remote Repository Support**: Process remote GitHub repositories directly
- 💾 **File Saving**: Save the processed codebase to a file
- 🔧 **Customizable Options**: Control how the codebase is processed with various options (comments, line numbers, file summaries, etc.)

## Installation

### From NPM (Recommended)

```bash
# Install the package globally
npm install -g codebase-mcp

# Install RepoMix (required dependency)
codebase-mcp install
```

### From GitHub

```bash
# Clone the repository
git clone https://github.com/DeDeveloper23/codebase-mcp.git

# Navigate to the project directory
cd codebase-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Install globally
npm install -g .

# Install RepoMix (required dependency)
codebase-mcp install
```

## Integration with Cursor

To use this MCP with Cursor's Composer Agent:

1. Open Cursor IDE
2. Click the Composer icon in the sidebar
3. Click the "MCP Servers" button at the top
4. Click "Add new MCP server"
5. Fill in the details:
   - Name: `Codebase MCP` (or any name you prefer)
   - Type: `command`
   - Command: `codebase-mcp start`
6. Click "Add" to save

Once added, the MCP will provide three powerful tools to the Composer Agent:

### Available Tools

1. **getCodebase**
   - Purpose: Analyzes your current workspace/project
   - Use when: You want the AI to understand your entire codebase
   - Example prompt: "Please analyze my codebase to understand its structure"

2. **getRemoteCodebase**
   - Purpose: Fetches and analyzes any public GitHub repository
   - Use when: You want to explore or understand other projects
   - Example prompt: "Can you analyze the repository at github.com/username/repo?"

3. **saveCodebase**
   - Purpose: Saves the codebase analysis to a file for later use
   - Use when: You want to preserve the codebase snapshot or share it
   - Example prompt: "Save an analysis of this codebase to review later"

### Example Usage in Cursor

Here are some example prompts you can use with the Composer Agent:

```
"Analyze my current project and explain its main components."

"Can you look at the tensorflow/tensorflow repository and explain how their testing framework works?"

"Save an analysis of my project to 'codebase-analysis.md' in markdown format."
```

The Composer Agent will automatically use the appropriate tool based on your request.

## Usage Outside Cursor

### Starting the MCP Server

```bash
codebase-mcp start
```

This will start the MCP server in stdio mode, which can be used by any MCP-compatible clients.

---

## Ignoring Files and Folders from Indexing

You can create a file named `.codebaseignore` at the root of your project to specify files and folders that should be ignored during codebase indexing by the MCP. The format is similar to `.gitignore`. This ensures that sensitive, large, or irrelevant files are not processed.

Example usage:
```
node_modules/
dist/
*.log
.env
```

---


## Installation and Usage in Cline (VS Code)

### Manual Installation

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/HellFiveOsborn/codebase-mcp.git
   cd codebase-mcp
   npm install
   npm run build
   ```

2. **Add the MCP server configuration to the Cline settings file:**

   Open the `cline_mcp_settings.json` file or access it via "Configure MCP Servers" in the Cline interface.

   Add the following block:
   ```json
   {
     "mcpServers": {
       "codebase-mcp": {
         "type": "stdio",
         "command": "node",
         "args": ["dist/cli.js", "start"]
       }
     }
   }
   ```

   > **Important:**  
   > - The `"command"` field must be `"node"` and the arguments should point to `"dist/cli.js", "start"`.
   > - Make sure to run `npm run build` before starting the MCP.

3. **Restart Cline or use the restart button in the MCP Servers interface.**

### Installation via Cline Interface

1. Open VS Code and click the Cline icon in the sidebar.
2. Go to "MCP Servers" > "Installed" > "Configure MCP Servers".
3. Add the configuration block above.
4. Save and restart the MCP server.

### Testing the Installation

After configuration, ask Cline to execute the `getCodebase` tool:
- Example:  
  > "@codebase get the current codebase using the MCP."

The output will be a clean summary of the codebase, including main statistics.

### Troubleshooting

- If you see a "command not found" error, make sure Node.js is installed and available in your PATH.
- Ensure the `dist/` directory and the `dist/cli.js` file exist (run `npm run build`).
- Use only the flags supported by [RepoMix](https://github.com/yamadashy/repomix) (see `npx repomix --help`).

### Note for Cline AI

> This MCP server must be configured with:
> - `"command": "node"`
> - `"args": ["dist/cli.js", "start"]`
> - `"type": "stdio"`
> 
> Do not use `"npx"` or `"codebase-mcp"` directly in the `"command"` field.

---

## Mandatory Instructional Prompt for AI

To ensure proper functionality of this MCP with AI agents (such as Cline, Cursor, Claude, etc.), add the following instructional prompt to the `.clinerules`, `.cursorrules` file, or directly into the AI system prompt. You may concatenate it with your existing prompt:

```
Whenever the input contains '@codebase', use the 'codebase-mcp' MCP to index and analyze the project. Perform the analysis directly, without explanations or additional comments. Return the result in XML format only.

After indexing, do not immediately execute the user's request. First, analyze the intent: determine whether the user is asking a question or requesting a code change (creation/modification).

Then, identify the most relevant file(s) mentioned or implied in the request. Use the `searchCodebase` tool to retrieve contextual snippets from the indexed codebase file (e.g., {NAME}.codebase).

- If the user asked a question, return an answer based only on the retrieved context.
- If the user requested a creation or modification, use the retrieved context to accurately implement the requested changes directly in the actual project file(s), not in the codebase index.

Only proceed with execution after fully understanding the request and retrieving the necessary context. All actions must be guided by relevance and consistency with the project’s structure.
```

---

## License

MIT
