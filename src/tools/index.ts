import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as github from "../github/index.js";
import { CodeSearchResultItem } from "../github/searchFiles";

/**
 * Register GitHub tools with the MCP server
 *
 * This function registers all GitHub-related tools with the MCP server
 * to make them available for LLMs to use.
 *
 * @param {McpServer} server - The MCP server instance
 */
export function registerGitHubTools(server: McpServer): void {
  // Tool 1: Search repositories
  server.tool(
    "search-repositories",
    "Search for GitHub repositories by query",
    {
      query: z.string().describe("Search query for repositories"),
      limit: z
        .number()
        .min(1)
        .max(30)
        .default(10)
        .describe("Maximum number of repositories to return"),
    },
    async ({ query, limit }) => {
      try {
        const results = await github.searchRepositories(query, limit);

        const repositories = results.search.edges.map((edge) => {
          const repo = edge.node;
          return {
            name: repo.nameWithOwner,
            description: repo.description || "No description",
            url: repo.url,
            stars: repo.stargazerCount,
            forks: repo.forkCount,
            language: repo.primaryLanguage?.name || "Not specified",
            updated: repo.updatedAt,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.search.repositoryCount} repositories matching "${query}":\n\n${repositories
                .map(
                  (repo) =>
                    `- ${repo.name} (${repo.language}): ${repo.description}\n  ${repo.stars} stars, ${repo.forks} forks\n  ${repo.url}`,
                )
                .join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in search-repositories tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error searching repositories: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 2: Get repository information
  server.tool(
    "get-repository-info",
    "Get detailed information about a specific GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
    },
    async ({ owner, name }) => {
      try {
        const result = await github.getRepository(owner, name);
        const repo = result.repository;

        if (!repo) {
          return {
            content: [
              {
                type: "text",
                text: `Repository ${owner}/${name} not found.`,
              },
            ],
          };
        }

        // Format languages
        const languages = repo.languages.edges
          .map(
            (edge) => `${edge.node.name} (${(edge.size / 1024).toFixed(1)} KB)`,
          )
          .join(", ");

        const repoInfo = `
# ${repo.nameWithOwner}

${repo.description || "No description provided."}

## Repository Information
- URL: ${repo.url}
- Homepage: ${repo.homepageUrl || "Not specified"}
- Stars: ${repo.stargazerCount}
- Forks: ${repo.forkCount}
- Default branch: ${repo.defaultBranchRef?.name || "master"}
- License: ${repo.licenseInfo?.name || "Not specified"}
- Last updated: ${new Date(repo.updatedAt).toLocaleDateString()}
- Language(s): ${languages}
- Status: ${repo.isArchived ? "Archived" : "Active"}${repo.isTemplate ? ", Template repository" : ""}
`;

        return {
          content: [
            {
              type: "text",
              text: repoInfo.trim(),
            },
          ],
        };
      } catch (error) {
        console.error("Error in get-repository-info tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching repository information: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 3: Get repository README
  server.tool(
    "get-repository-readme",
    "Get the README content of a GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
    },
    async ({ owner, name }) => {
      try {
        const readme = await github.getReadmeContent(owner, name);

        if (!readme) {
          return {
            content: [
              {
                type: "text",
                text: `README not found for repository ${owner}/${name}.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `# README for ${owner}/${name}\n\n${readme}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in get-repository-readme tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching README: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 4: Search files in repository
  server.tool(
    "search-repository-files",
    "Search for files in a GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
      path: z
        .string()
        .optional()
        .describe("Directory path within repository (optional)"),
      query: z
        .string()
        .optional()
        .describe("Search term to filter files (optional)"),
    },
    async ({ owner, name, path = "", query = "" }) => {
      try {
        const files = await github.searchFiles(owner, name, path, query);

        const filesList = files
          .map((file) => `- ${file.name} (${file.type}): ${file.path}`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Files in ${owner}/${name}${path ? `/${path}` : ""}${query ? ` matching "${query}"` : ""}:\n\n${filesList}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in search-repository-files tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error searching files: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 5: Get file content
  server.tool(
    "get-file-content",
    "Get the content of a specific file from a GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
      path: z.string().describe("File path within repository"),
    },
    async ({ owner, name, path }) => {
      try {
        const content = await github.getFileContent(owner, name, path);

        // Determine if we should show as code block based on file extension
        const fileExtension = path.split(".").pop()?.toLowerCase() || "";
        const codeLanguages = [
          "js",
          "ts",
          "jsx",
          "tsx",
          "py",
          "java",
          "c",
          "cpp",
          "cs",
          "go",
          "rb",
          "php",
          "rust",
          "scala",
          "swift",
          "kt",
        ];
        const isCode = codeLanguages.includes(fileExtension);

        let formattedContent;
        if (isCode) {
          formattedContent = `\`\`\`${fileExtension}\n${content}\n\`\`\``;
        } else {
          formattedContent = content;
        }

        return {
          content: [
            {
              type: "text",
              text: `# File: ${path} (from ${owner}/${name})\n\n${formattedContent}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in get-file-content tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching file content: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 6: Get repository structure
  server.tool(
    "get-repository-structure",
    "Get the directory structure of a GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
      path: z
        .string()
        .optional()
        .describe("Directory path within repository (optional)"),
      maxDepth: z
        .number()
        .min(1)
        .max(5)
        .default(3)
        .describe("Maximum recursion depth (1-5)"),
    },
    async ({ owner, name, path = "", maxDepth = 3 }) => {
      try {
        const structure = await github.getRepositoryStructure(
          owner,
          name,
          path,
          maxDepth,
        );

        // Recursively format the structure
        function formatStructure(
          item: github.StructureEntry,
          level = 0,
        ): string {
          const indent = " ".repeat(level * 2);
          if (item.type === "dir") {
            const dirLine = `${indent}- 📁 ${item.name}/`;
            if (!("contents" in item) || item.contents.length === 0) {
              return dirLine + " (empty)";
            }
            return (
              dirLine +
              "\n" +
              item.contents
                .map((child) => formatStructure(child, level + 1))
                .join("\n")
            );
          } else {
            return `${indent}- 📄 ${item.name} (${(item.size / 1024).toFixed(1)} KB)`;
          }
        }

        const formattedStructure = formatStructure(structure);

        return {
          content: [
            {
              type: "text",
              text: `# Repository Structure: ${owner}/${name}${path ? `/${path}` : ""}\n\n${formattedStructure}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in get-repository-structure tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching repository structure: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 7: Extract API documentation
  server.tool(
    "get-repository-api-docs",
    "Extract API documentation from a GitHub repository README",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
    },
    async ({ owner, name }) => {
      try {
        const apiDocs = await github.extractApiDocumentation(owner, name);

        if (!apiDocs) {
          return {
            content: [
              {
                type: "text",
                text: `Could not extract API documentation for ${owner}/${name}. The repository may not have explicit API documentation in the README or dedicated documentation files.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `# API Documentation for ${owner}/${name}\n\n${apiDocs}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in get-repository-api-docs tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error extracting API documentation: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Tool 8: Search repository code
  server.tool(
    "search-repository-code",
    "Search for code within a GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      name: z.string().describe("Repository name"),
      query: z.string().describe("Search query for code content"),
    },
    async ({ owner, name, query }) => {
      try {
        const results = await github.searchRepositoryCode(owner, name, query);

        if (!results.items || results.items.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No code matching "${query}" found in ${owner}/${name}.`,
              },
            ],
          };
        }

        const filesFound = results.items
          .map(
            (item: CodeSearchResultItem) =>
              `- [${item.path}](${item.html_url}) (${item.name})`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.total_count} code results matching "${query}" in ${owner}/${name}:\n\n${filesFound}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in search-repository-code tool:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error searching repository code: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );
}
