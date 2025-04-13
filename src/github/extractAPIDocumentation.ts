import { getReadmeContent } from "./getReadmeContent.js";
import { getFileContent } from "./getFileContent.js";
import { getRepositoryFiles } from "./getRepositoryStructure.js";
import * as cache from "./utils/cache.js";

/**
 * Typical API documentation section title patterns
 */
const API_SECTION_PATTERNS = [
  /api(\s+reference)?/i,
  /usage/i,
  /(public\s+)?interface/i,
  /methods/i,
  /functions/i,
  /components/i,
  /endpoints/i,
  /examples?/i,
  /getting\s+started/i,
  /installation/i,
  /quick\s+start/i,
];

/**
 * Extract API documentation from a repository README
 *
 * Analyzes the README content to identify and extract sections that likely
 * contain API documentation based on common documentation patterns.
 * Results are cached to improve performance.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @returns {Promise<string | null>} Extracted API documentation as markdown, or null if not found
 * @throws {Error} If the repository doesn't exist or API requests fail
 *
 * @example
 * // Extract API documentation from the axios repository
 * const apiDocs = await extractApiDocumentation("axios", "axios");
 * console.log(apiDocs?.substring(0, 200) + "...");
 */
export async function extractApiDocumentation(
  owner: string,
  name: string,
): Promise<string | null> {
  // Generate cache key
  const cacheKey = `api-docs:${owner}/${name}`;

  // Check cache first
  const cachedResult = cache.get<string | null>(cacheKey);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  try {
    // Get README content
    const readme = await getReadmeContent(owner, name);
    if (!readme) {
      cache.set(cacheKey, null);
      return null;
    }

    // Extract API documentation sections
    const apiSections = extractApiSections(readme);

    // If no API sections found in README, look for dedicated API documentation files
    if (apiSections.length === 0) {
      const apiDocs = await findDedicatedApiDocs(owner, name);
      if (apiDocs) {
        cache.set(cacheKey, apiDocs);
        return apiDocs;
      }

      // Fallback: extract code blocks if no API sections found
      const codeBlocksSection = extractCodeBlocks(readme);
      if (codeBlocksSection) {
        cache.set(cacheKey, codeBlocksSection);
        return codeBlocksSection;
      }

      cache.set(cacheKey, null);
      return null;
    }

    // Combine API sections
    const combinedDocs = apiSections.join("\n\n");
    cache.set(cacheKey, combinedDocs);
    return combinedDocs;
  } catch (error) {
    console.error(`Error extracting API docs for ${owner}/${name}:`, error);
    // Don't cache errors
    return null;
  }
}

/**
 * Extract API documentation sections from README content
 *
 * Analyzes the README content to identify sections that appear to be API documentation
 * based on section titles and content patterns.
 *
 * @param {string} readme - The README content
 * @returns {string[]} Array of extracted API documentation sections
 * @private
 */
function extractApiSections(readme: string): string[] {
  const apiSections: string[] = [];

  // Split by markdown headers (supports # through ######)
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections: {
    level: number;
    title: string;
    content: string;
    start: number;
  }[] = [];
  let lastIndex = 0;
  let match;

  // Extract all headers and their content
  while ((match = headerRegex.exec(readme)) !== null) {
    if (lastIndex > 0) {
      const prevSection = sections[sections.length - 1];
      prevSection.content = readme.substring(lastIndex, match.index).trim();
    }

    sections.push({
      level: match[1].length,
      title: match[2].trim(),
      content: "",
      start: match.index,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add the last section content
  if (sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    lastSection.content = readme.substring(lastIndex).trim();
  }

  // Identify API documentation sections
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const isApiSection = API_SECTION_PATTERNS.some((pattern) =>
      pattern.test(section.title),
    );

    if (isApiSection) {
      // Find the end of this section (the next section at the same or higher level)
      let endIndex = readme.length;
      for (let j = i + 1; j < sections.length; j++) {
        if (sections[j].level <= section.level) {
          endIndex = sections[j].start;
          break;
        }
      }

      // Extract the complete section including its subsections
      const completeSection = readme.substring(section.start, endIndex).trim();
      apiSections.push(completeSection);

      // Skip subsections that we've already included
      while (i + 1 < sections.length && sections[i + 1].level > section.level) {
        i++;
      }
    }
  }

  return apiSections;
}

/**
 * Find dedicated API documentation files in the repository
 *
 * Looks for files that are likely to contain API documentation.
 *
 * @param {string} owner - Repository owner
 * @param {string} name - Repository name
 * @returns {Promise<string | null>} Content of the API documentation file, or null if not found
 * @private
 */
async function findDedicatedApiDocs(
  owner: string,
  name: string,
): Promise<string | null> {
  // Common API documentation file paths
  const possiblePaths = [
    "API.md",
    "docs/API.md",
    "documentation/API.md",
    "api.md",
    "docs/api.md",
    "API_REFERENCE.md",
    "DOCUMENTATION.md",
  ];

  // Try each path
  for (const path of possiblePaths) {
    try {
      const content = await getFileContent(owner, name, path);
      if (content) {
        return `# API Documentation (from ${path})\n\n${content}`;
      }
    } catch {
      console.debug("File not found:", path);
    }
  }

  // Look for files in the docs directory
  try {
    const files = await getRepositoryFiles(owner, name, "md");
    const docsPaths = files.filter(
      (path) =>
        path.includes("/docs/") ||
        path.includes("/documentation/") ||
        path.toLowerCase().includes("api") ||
        path.toLowerCase().includes("usage"),
    );

    // Check the first matching file
    if (docsPaths.length > 0) {
      try {
        const content = await getFileContent(owner, name, docsPaths[0]);
        return `# API Documentation (from ${docsPaths[0]})\n\n${content}`;
      } catch {
        // Failed to get content, continue
      }
    }
  } catch {
    // Failed to get files, continue
  }

  return null;
}

/**
 * Extract code blocks from README content as a fallback
 *
 * If no API documentation sections are found, extract code blocks as examples.
 *
 * @param {string} readme - The README content
 * @returns {string | null} Extracted code blocks section, or null if none found
 * @private
 */
function extractCodeBlocks(readme: string): string | null {
  // Match code blocks (```language ... ```)
  const codeBlockRegex = /```[a-z]*\n[\s\S]*?\n```/g;
  const codeBlocks = readme.match(codeBlockRegex);

  if (!codeBlocks || codeBlocks.length === 0) {
    return null;
  }

  // Only include blocks that are likely to be API examples
  const apiExamples = codeBlocks.filter((block) => {
    // Look for patterns like function calls, method invocations, or import statements
    return (
      /\w+\(.*\)/.test(block) || // function calls
      /\w+\.\w+/.test(block) || // method invocations
      /import\s+.*from\s+/.test(block)
    ); // import statements
  });

  if (apiExamples.length === 0) {
    return null;
  }

  return (
    "## Code Examples\n\nThe following examples were extracted from the README:\n\n" +
    apiExamples.join("\n\n")
  );
}
