# GitCP: Supercharge Your LLMs with Real-time GitHub Context

![License](https://img.shields.io/badge/License-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)
![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)

> *"But my GitHub repo changed yesterday..." - Never worry about outdated information in your AI assistants again.*

GitCP (GitHub Context Provider) bridges the gap between GitHub and Large Language Models, giving AI assistants real-time access to repository information through the standardized Model Context Protocol (MCP).

<p align="center">
  <img src="docs/images/gitcp-diagram.png" alt="GitCP Architecture" width="600"/>
</p>

## 🔥 Why GitCP?

- **Accurate, Real-time Information:** LLMs often have outdated knowledge about repositories. GitCP provides the latest API docs, README contents, and codebase structure.
- **Deeper Understanding:** Help LLMs grasp your project's architecture, design principles, and API usage patterns.
- **Seamless Integration:** Compatible with any MCP-enabled models, including Claude, GPT, and others.
- **Highly Efficient:** Intelligent caching reduces API calls while keeping information fresh.

## ✨ Key Features

- **API Documentation Extraction:** Automatically identifies and extracts API documentation from READMEs and dedicated documentation files
- **Repository Structure Analysis:** Provides a map of your codebase's organization
- **README Content Retrieval:** Gets the latest documentation directly from GitHub
- **File Content Search:** Find and extract specific files or code snippets
- **Repository Search:** Discover repositories matching specific criteria

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gitcp.git
cd gitcp

# Install dependencies
pnpm install

# Set up your GitHub token (required) - Option 1: Environment variable
echo "GITHUB_TOKEN=your_github_token" > .env

# Start the server
pnpm start

# OR using Option 2: Command-line argument
pnpm start --GITHUB_TOKEN your_github_token
```

### Usage with LLMs

Connect your MCP-compatible LLM to the GitCP server endpoint:

```
http://localhost:3000/api/mcp
```

Your LLM will now have access to tools like:
- `get-repository-info`: Get detailed information about a repository
- `get-repository-readme`: Retrieve the current README content
- `get-repository-api-docs`: Extract API documentation
- `search-repository-files`: Find files in a repository
- `get-file-content`: Retrieve specific file contents

## 🔍 Example Scenario

Ask your MCP-enabled AI assistant:

> "What are the available methods in the axios library for handling request interceptors?"

Instead of getting outdated or generic information, your assistant can:
1. Use `get-repository-api-docs` to fetch the latest axios API documentation
2. Analyze the current documentation for interceptor methods
3. Provide you with accurate, up-to-date information

## 🧰 Architecture

GitCP follows a modular design:

```
┌─────────────────┐       ┌──────────────┐       ┌────────────────┐
│   MCP Server    │◄─────►│  GitHub API  │◄─────►│  GitHub.com    │
│  (TypeScript)   │       │    Client    │       │                │
└────────┬────────┘       └──────────────┘       └────────────────┘
         │
         │
┌────────▼────────┐       ┌──────────────┐
│ Context         │       │   Caching    │
│ Processors      │◄─────►│   System     │
└─────────────────┘       └──────────────┘
```

- **MCP Server:** Handles the Model Context Protocol communication
- **GitHub API Client:** Manages GitHub REST and GraphQL API interactions
- **Context Processors:** Extract and organize relevant information
- **Caching System:** Improves performance and reduces API load

## 🧠 Why It Matters

Traditional AI assistants struggle with:
- Outdated knowledge of repositories
- Incomplete understanding of project structure
- Inability to see recent changes and updates

GitCP solves these problems by giving LLMs a direct line to GitHub's latest information, making your AI assistants more accurate, more helpful, and more in sync with your evolving codebase.

## 🛠️ Development

```bash
# Build the project
pnpm run build

# Run tests
pnpm test

# Lint your code
pnpm run lint

# Format your code
pnpm run format
```

## 📝 License

This project is MIT licensed - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <i>GitCP: Because your AI assistant should understand your code as well as you do.</i>
</p>
