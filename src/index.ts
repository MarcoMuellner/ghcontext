#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGitHubTools } from "./tools/index.js";
import * as github from "./github/index.js";
import dotenv from "dotenv";

// Parse command-line arguments
let githubToken: string | undefined;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--GITHUB_TOKEN" || arg === "--github-token") {
    githubToken = process.argv[i + 1];
    i++; // Skip the next argument as it's the token value
  }
}

// Load environment variables
dotenv.config();

// Log token source information (but not the token itself)
try {
  const { source } = github.getToken(githubToken);
} catch {
  console.error(
    "GitHub token not found. Please set GITHUB_TOKEN environment variable, pass it with --GITHUB_TOKEN, or authenticate with GitHub CLI.",
  );
  process.exit(1);
}

/**
 * Main function to run the server
 */
async function main() {
  // Create server instance
  const server = new McpServer({
    name: "GitCP",
    version: "1.0.0",
    description: "GitHub Context Provider for LLMs",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  // Register GitHub tools
  registerGitHubTools(server);

  // Set up transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run the server
main().catch((error) => {
  console.error("Error running GitCP server:", error);
  process.exit(1);
});
