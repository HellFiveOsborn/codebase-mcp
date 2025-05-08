#!/usr/bin/env node

/**
 * MCP Alias: @codebase
 *
 * This MCP server is designed to respond to natural language commands prefixed with `@codebase`,
 * even if the server is registered as "codebase-mcp" in the MCP servers configuration.
 *
 * Example usage:
 *   @codebase analyze and summarize the project
 *   @codebase get a codebase overview
 *
 * The AI should route any `@codebase ...` command to this MCP server.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Create MCP server
const server = new McpServer({
  name: "codebase-mcp",
  version: "1.0.1",
});

/**
* Reads and processes the .codebaseignore file in the given directory.
* Returns a comma-separated string of glob patterns, or undefined if the file does not exist.
*/
function getCodebaseIgnoreGlobs(workingDir: string): string | undefined {
  const ignorePath = path.join(workingDir, ".codebaseignore");
  if (!fs.existsSync(ignorePath)) return undefined;
  const lines = fs.readFileSync(ignorePath, "utf8")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  if (lines.length === 0) return undefined;
  return lines.join(",");
}

// Define the 'getCodebase' tool
server.tool(
  "getCodebase",
  "Retrieve the entire codebase as a single text output using RepoMix",
  {
    cwd: z.string().describe("Current working directory of the codebase (defaults to current dir)").optional(),
    format: z.enum(["xml", "markdown", "plain"]).describe("Output format (xml, markdown, or plain)").default("xml").optional(),
    includeFileSummary: z.boolean().describe("Include summary of each file").default(true).optional(),
    includeDirectoryStructure: z.boolean().describe("Include directory structure").default(true).optional(),
    removeComments: z.boolean().describe("Remove comments from the code").default(false).optional(),
    removeEmptyLines: z.boolean().describe("Remove empty lines from the code").default(false).optional(),
    showLineNumbers: z.boolean().describe("Show line numbers").default(true).optional(),
    includePatterns: z.string().describe("Include patterns (using glob patterns, comma-separated)").optional(),
    ignorePatterns: z.string().describe("Ignore patterns (using glob patterns, comma-separated)").optional(),
  },
  async ({ cwd, format, includeFileSummary, includeDirectoryStructure, removeComments, removeEmptyLines, showLineNumbers, includePatterns, ignorePatterns }) => {
    try {
      // Prepare options for Repomix
      const workingDir = cwd || process.cwd();
      
      let command = "npx repomix --output project.codebase";

      // Add only valid formatting options
      if (format) {
        command += ` --style ${format}`;
      }
      if (removeComments === true) {
        command += ` --remove-comments`;
      }
      if (removeEmptyLines === true) {
        command += ` --remove-empty-lines`;
      }
      if (showLineNumbers === true) {
        command += ` --output-show-line-numbers`;
      }
      // Only add --no-file-summary if user explicitly disables it
      if (includeFileSummary === false) {
        command += ` --no-file-summary`;
      }
      // Only add --no-directory-structure if user explicitly disables it
      if (includeDirectoryStructure === false) {
        command += ` --no-directory-structure`;
      }
      if (includePatterns) {
        command += ` --include "${includePatterns}"`;
      }
      // Logic for .codebaseignore
      const ignoreFromFile = getCodebaseIgnoreGlobs(workingDir);
      let combinedIgnore: string | undefined;
      if (ignorePatterns && ignoreFromFile) {
        combinedIgnore = `${ignorePatterns},${ignoreFromFile}`;
      } else if (ignorePatterns) {
        combinedIgnore = ignorePatterns;
      } else if (ignoreFromFile) {
        combinedIgnore = ignoreFromFile;
      }
      if (combinedIgnore) {
        command += ` --ignore "${combinedIgnore}"`;
      }

      console.error(`Running command: ${command}`);

      // Run Repomix to dump the codebase
      const output = execSync(command, {
        cwd: workingDir,
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large codebases
      }).toString();

      // Filter Repomix banners and promotional messages
      let filtered = output;
      filtered = filtered
        .split('\n')
        .filter(line =>
          !line.includes('Repomix is now available') &&
          !line.includes('https://repomix.com') &&
          !line.toLowerCase().includes('repomix') &&
          !line.includes('Pack your codebase into AI-friendly formats')
        )
        .join('\n')
        .trim();

      // Extract directory structure if present
      let directoryStructure = "";
      const dirStart = filtered.match(/Directory Structure:?/i);
      if (dirStart) {
        const idx = filtered.indexOf(dirStart[0]);
        // Goes to the next block (e.g. "Pack Summary" or "Total Files" or end)
        let endIdx = filtered.length;
        const summaryIdx = filtered.indexOf("Pack Summary", idx + 1);
        const totalFilesIdx = filtered.indexOf("Total Files", idx + 1);
        if (summaryIdx !== -1 && summaryIdx > idx) endIdx = Math.min(endIdx, summaryIdx);
        if (totalFilesIdx !== -1 && totalFilesIdx > idx) endIdx = Math.min(endIdx, totalFilesIdx);
        directoryStructure = filtered.slice(idx + dirStart[0].length).trim();
        if (endIdx !== filtered.length) {
          directoryStructure = filtered.slice(idx + dirStart[0].length, endIdx).trim();
        }
      }

      // Return only the summary block if it exists
      let summaryBlock = filtered;
      const summaryStart = filtered.match(/(Pack Summary:|Total Files:)/);
      if (summaryStart) {
        const idx = filtered.indexOf(summaryStart[0]);
        summaryBlock = filtered.slice(idx).trim();
      } else {
        // fallback: last 20 lines
        const lines = filtered.trim().split('\n');
        summaryBlock = lines.slice(-20).join('\n');
      }

      // Assemble response with directory structure (if found)
      const contentArr: { type: "text"; text: string }[] = [];
      if (directoryStructure) {
        contentArr.push({
          type: "text" as const,
          text: `<directory_structure>\n${directoryStructure}\n</directory_structure>`,
        });
      }
      contentArr.push({
        type: "text" as const,
        text: summaryBlock,
      });

      return {
        content: contentArr,
      };
    } catch (error: unknown) {
      console.error("Error running Repomix:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving codebase: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Define the 'getRemoteCodebase' tool for processing remote repositories
server.tool(
  "getRemoteCodebase",
  "Retrieve a remote repository's codebase as a single text output using RepoMix",
  {
    repo: z.string().describe("GitHub repository URL or shorthand format (e.g., 'username/repo')"),
    format: z.enum(["xml", "markdown", "plain"]).describe("Output format (xml, markdown, or plain)").default("xml").optional(),
    includeFileSummary: z.boolean().describe("Include summary of each file").default(true).optional(),
    includeDirectoryStructure: z.boolean().describe("Include directory structure").default(true).optional(),
    removeComments: z.boolean().describe("Remove comments from the code").default(false).optional(),
    removeEmptyLines: z.boolean().describe("Remove empty lines from the code").default(false).optional(),
    showLineNumbers: z.boolean().describe("Show line numbers").default(true).optional(),
    includePatterns: z.string().describe("Include patterns (using glob patterns, comma-separated)").optional(),
    ignorePatterns: z.string().describe("Ignore patterns (using glob patterns, comma-separated)").optional(),
  },
  async ({ repo, format, includeFileSummary, includeDirectoryStructure, removeComments, removeEmptyLines, showLineNumbers, includePatterns, ignorePatterns }) => {
    try {
      let command = `npx repomix --remote ${repo} --output remote.codebase`;
      
      // Add formatting options
      if (format) {
        command += ` --style ${format}`;
      }
      
      if (includeFileSummary === true) {
        command += ` --include-file-summary`;
      } else if (includeFileSummary === false) {
        command += ` --no-include-file-summary`;
      }
      
      if (includeDirectoryStructure === true) {
        command += ` --include-directory-structure`;
      } else if (includeDirectoryStructure === false) {
        command += ` --no-include-directory-structure`;
      }
      
      if (removeComments === true) {
        command += ` --remove-comments`;
      } else if (removeComments === false) {
        command += ` --no-remove-comments`;
      }
      
      if (removeEmptyLines === true) {
        command += ` --remove-empty-lines`;
      } else if (removeEmptyLines === false) {
        command += ` --no-remove-empty-lines`;
      }
      
      if (showLineNumbers === true) {
        command += ` --show-line-numbers`;
      } else if (showLineNumbers === false) {
        command += ` --no-show-line-numbers`;
      }
      
      if (includePatterns) {
        command += ` --include "${includePatterns}"`;
      }
      
      console.error(`Running command: ${command}`);
      
      // Run Repomix to dump the codebase
      const output = execSync(command, {
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large codebases
      }).toString();

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error: unknown) {
      console.error("Error running Repomix on remote repository:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving remote codebase: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Define the 'saveCodebase' tool for saving the codebase to a file
server.tool(
  "saveCodebase",
  "Save the codebase to a file using RepoMix",
  {
    cwd: z.string().describe("Current working directory of the codebase (defaults to current dir)").optional(),
    outputFile: z.string().describe("Output file path").default("repomix-output.txt"),
    format: z.enum(["xml", "markdown", "plain"]).describe("Output format (xml, markdown, or plain)").default("xml").optional(),
    includeFileSummary: z.boolean().describe("Include summary of each file").default(true).optional(),
    includeDirectoryStructure: z.boolean().describe("Include directory structure").default(true).optional(),
    removeComments: z.boolean().describe("Remove comments from the code").default(false).optional(),
    removeEmptyLines: z.boolean().describe("Remove empty lines from the code").default(false).optional(),
    showLineNumbers: z.boolean().describe("Show line numbers").default(true).optional(),
    includePatterns: z.string().describe("Include patterns (using glob patterns, comma-separated)").optional(),
    ignorePatterns: z.string().describe("Ignore patterns (using glob patterns, comma-separated)").optional(),
  },
  async ({ cwd, outputFile, format, includeFileSummary, includeDirectoryStructure, removeComments, removeEmptyLines, showLineNumbers, includePatterns, ignorePatterns }) => {
    try {
      // Prepare options for Repomix
      const workingDir = cwd || process.cwd();
      const outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(workingDir, outputFile);
      
      let command = `npx repomix --output "${outputPath}"`;
      
      // Add formatting options
      if (format) {
        command += ` --style ${format}`;
      }
      
      if (includeFileSummary === true) {
        command += ` --include-file-summary`;
      } else if (includeFileSummary === false) {
        command += ` --no-include-file-summary`;
      }
      
      if (includeDirectoryStructure === true) {
        command += ` --include-directory-structure`;
      } else if (includeDirectoryStructure === false) {
        command += ` --no-include-directory-structure`;
      }
      
      if (removeComments === true) {
        command += ` --remove-comments`;
      } else if (removeComments === false) {
        command += ` --no-remove-comments`;
      }
      
      if (removeEmptyLines === true) {
        command += ` --remove-empty-lines`;
      } else if (removeEmptyLines === false) {
        command += ` --no-remove-empty-lines`;
      }
      
      if (showLineNumbers === true) {
        command += ` --show-line-numbers`;
      } else if (showLineNumbers === false) {
        command += ` --no-show-line-numbers`;
      }
      
      if (includePatterns) {
        command += ` --include "${includePatterns}"`;
      }
      
      // Logic for .codebaseignore
      const ignoreFromFile = getCodebaseIgnoreGlobs(workingDir);
      let combinedIgnore: string | undefined;
      if (ignorePatterns && ignoreFromFile) {
        combinedIgnore = `${ignorePatterns},${ignoreFromFile}`;
      } else if (ignorePatterns) {
        combinedIgnore = ignorePatterns;
      } else if (ignoreFromFile) {
        combinedIgnore = ignoreFromFile;
      }
      if (combinedIgnore) {
        command += ` --ignore "${combinedIgnore}"`;
      }

      console.error(`Running command: ${command}`);
      
      // Run Repomix to save the codebase to a file
      execSync(command, {
        cwd: workingDir,
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large codebases
      });

      // Check if the file was created successfully
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        return {
          content: [
            {
              type: "text",
              text: `Codebase saved successfully to ${outputPath} (${fileSizeInMB.toFixed(2)} MB)`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Failed to save codebase to ${outputPath}. File was not created.`,
            },
          ],
        };
      }
    } catch (error: unknown) {
      console.error("Error saving codebase:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error saving codebase: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

/**
 * Tool: searchCodebase
 * Performs a simple text search in the saved codebase file (e.g., project.codebase) and returns relevant snippets.
 */
server.tool(
  "searchCodebase",
  "Returns the content of a specific file from the codebase, with line numbers, for easy navigation.",
  {
    file: z.string().describe("Relative path of the file to extract (e.g. src/cli.ts)"),
    codebase: z.string().describe("Codebase file to search").default("project.codebase").optional(),
    maxLines: z.number().describe("Maximum number of lines to return").default(40).optional(),
  },
  async ({ file, codebase, maxLines }) => {
    try {
      const codebaseFile = codebase || "project.codebase";
      if (!fs.existsSync(codebaseFile)) {
        return {
          content: [
            {
              type: "text",
              text: `Codebase file not found: ${codebaseFile}`,
            },
          ],
        };
      }
      if (!file) {
        return {
          content: [
            {
              type: "text",
              text: `Parameter 'file' is required.`,
            },
          ],
        };
      }
      const raw = fs.readFileSync(codebaseFile, "utf8");
      const lines = raw.split("\n");
      let currentFile: { path: string; content: string[] } | null = null;
      const fileBlocks: { path: string; content: string[] }[] = [];

      // Parse file blocks: supports both <file path="..."> and # File: ...
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // <file path="...">
        const xmlMatch = line.match(/^<file path="(.+?)">$/);
        if (xmlMatch) {
          if (currentFile) fileBlocks.push(currentFile);
          currentFile = { path: xmlMatch[1].trim(), content: [] };
          continue;
        }
        // # File: ...
        const hashMatch = line.match(/^# File: (.+)$/);
        if (hashMatch) {
          if (currentFile) fileBlocks.push(currentFile);
          currentFile = { path: hashMatch[1].trim(), content: [] };
          continue;
        }
        // </file> close XML block
        if (line.match(/^<\/file>$/)) {
          if (currentFile) fileBlocks.push(currentFile);
          currentFile = null;
          continue;
        }
        if (currentFile) {
          currentFile.content.push(line);
        }
      }
      if (currentFile) fileBlocks.push(currentFile);

      // Normalize paths for comparison
      function normalizePath(p: string) {
        return p.replace(/^\.\//, "").replace(/\\/g, "/").trim();
      }
      const requested = normalizePath(file);

      // Find the requested file (case-sensitive and case-insensitive fallback)
      let found = fileBlocks.find(
        f => normalizePath(f.path) === requested
      );
      if (!found) {
        found = fileBlocks.find(
          f => normalizePath(f.path).toLowerCase() === requested.toLowerCase()
        );
      }
      if (!found) {
        return {
          content: [
            {
              type: "text",
              text: `File "${file}" not found in codebase.`,
            },
          ],
        };
      }

      // Limit lines
      const maxL = maxLines ?? 40;
      const snippetLines = found.content.slice(0, maxL);
      let snippet = "";
      for (let i = 0; i < snippetLines.length; i++) {
        snippet += ` ${i + 1}: ${snippetLines[i]}\n`;
      }

      return {
        content: [
          {
            type: "text",
            text: `<file path="${found.path}">\n${snippet.trim()}\n</file>`,
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Error while extracting file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebase MCP Server running on stdio");
}

main().catch(console.error);
