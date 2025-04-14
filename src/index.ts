#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGitHubTools } from "./tools/index.js";
import fs from "fs";
import { setToken } from "./github/utils/getToken.js";

// Parse command-line arguments
let githubToken: string | undefined;
let showHelp = false;
let showVersion = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--GITHUB_TOKEN" || arg === "--github-token") {
    githubToken = process.argv[i + 1];
    i++; // Skip the next argument as it's the token value
  } else if (arg === "--help" || arg === "-h") {
    showHelp = true;
  } else if (arg === "--version" || arg === "-v") {
    showVersion = true;
  }
}

// Show help information if requested
if (showHelp) {
  console.log(`
ghcontext - GitHub Context Provider for LLMs

Usage: 
  ghcontext --GITHUB_TOKEN <token> [options]

Options:
  --GITHUB_TOKEN <token>    GitHub token for API authentication (REQUIRED)
  --github-token <token>    Alias for --GITHUB_TOKEN
  --help, -h                Show this help information
  --version, -v             Show version information

Examples:
  ghcontext --GITHUB_TOKEN your_github_token
  
  # The token is mandatory and must be provided via command line
  `);
  process.exit(0);
}

// Show version information if requested
if (showVersion) {
  const packageJson = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
  );
  console.log(`ghcontext version ${packageJson.version}`);
  process.exit(0);
}

/**
 * Main function to run the server
 */
async function main() {
  // Create server instance
  const server = new McpServer({
    name: "ghcontext",
    version: "1.0.0",
    description: "GitHub Context Provider for LLMs",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  // Token is required via command-line
  if (!githubToken) {
    console.error(
      "ERROR: GitHub token is required. Please provide it with --GITHUB_TOKEN option.",
    );
    console.log("Run with --help for usage information.");
    process.exit(1);
  }

  setToken(githubToken);

  // Register GitHub tools with the GitHub token
  registerGitHubTools(server);

  // Set up transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run the server
main().catch((error) => {
  console.error("Error running ghcontext server:", error);
  process.exit(1);
});
