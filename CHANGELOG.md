# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-04-14

### Added
- Initial release of ghcontext
- GitHub Context Provider for LLMs
- MCP server implementation for GitHub API integration
- Eight GitHub tools for repository exploration
    - search-repositories: Search for repositories by query
    - get-repository-info: Get detailed repository information
    - get-repository-readme: Retrieve README content
    - get-repository-api-docs: Extract API documentation
    - search-repository-files: Find files in a repository
    - get-file-content: Retrieve file contents
    - get-repository-structure: Map repository organization
    - search-repository-code: Search code within repositories
- Caching system for improved performance
- Full TypeScript implementation with comprehensive tests
