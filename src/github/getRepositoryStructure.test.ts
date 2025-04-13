// src/github/getRepositoryStructure.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRepositoryStructure, getRepositoryFiles, StructureEntry, StructureFile, StructureDirectory } from './getRepositoryStructure';
import { resetGitHubTestEnvironment, sampleRepoData } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Helper function to check if structure entry is a directory
function isDirectory(entry: StructureEntry): entry is StructureDirectory {
    return entry.type === 'dir';
}

// Helper function to check if structure entry is a file
function isFile(entry: StructureEntry): entry is StructureFile {
    return entry.type === 'file';
}

// Mock the getRepository function
vi.mock('./getRepository.js', () => ({
    getRepository: vi.fn()
}));

// Mock the REST client
vi.mock('./utils/client.js', () => {
    const mockRestClient = {
        repos: {
            getContent: vi.fn()
        },
        git: {
            getTree: vi.fn()
        }
    };

    return {
        getRESTClientSingleton: () => mockRestClient,
    };
});

// Mock the cache
vi.mock('./utils/cache.js', () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

describe('Repository Structure', () => {
    // REST client mock
    let mockRestClient: any;
    let mockGetRepository: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Get reference to the mocked REST client
        mockRestClient = require('./utils/client.js').getRESTClientSingleton();
        mockGetRepository = require('./getRepository.js').getRepository;

        // Setup default mock responses
        mockGetRepository.mockResolvedValue({
            repository: {
                ...sampleRepoData,
                defaultBranchRef: {
                    name: 'main'
                }
            }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getRepositoryStructure', () => {
        it('should return cached structure if available', async () => {
            // Arrange
            const cachedStructure: StructureDirectory = {
                name: 'react',
                path: '/',
                type: 'dir',
                contents: [
                    {
                        name: 'package.json',
                        path: 'package.json',
                        type: 'file',
                        size: 1000
                    }
                ]
            };
            vi.mocked(cache.get).mockReturnValue(cachedStructure);

            // Act
            const result = await getRepositoryStructure('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('structure:facebook/react::3');
            expect(mockRestClient.repos.getContent).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(cachedStructure);
        });

        it('should fetch repository structure when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock content response for root directory
            mockRestClient.repos.getContent.mockResolvedValueOnce({
                data: [
                    {
                        name: 'src',
                        path: 'src',
                        type: 'dir',
                        size: 0
                    },
                    {
                        name: 'package.json',
                        path: 'package.json',
                        type: 'file',
                        size: 1000
                    }
                ]
            });

            // Mock content response for src directory
            mockRestClient.repos.getContent.mockResolvedValueOnce({
                data: [
                    {
                        name: 'index.js',
                        path: 'src/index.js',
                        type: 'file',
                        size: 500
                    }
                ]
            });

            // Act
            const result = await getRepositoryStructure('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('structure:facebook/react::3');
            expect(mockGetRepository).toHaveBeenCalledWith('facebook', 'react');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: '',
                ref: 'main'
            });

            // Check structure format
            expect(result.type).toBe('dir');
            expect(result.name).toBe('react');

            // Need to check if result is a directory before accessing contents
            if (isDirectory(result)) {
                expect(result.contents).toHaveLength(2);

                // Check that files and directories are correctly parsed
                const srcDir = result.contents.find((item: StructureEntry) => item.name === 'src');
                expect(srcDir).toBeDefined();
                if (srcDir && isDirectory(srcDir)) {
                    expect(srcDir.type).toBe('dir');
                    expect(srcDir.contents).toHaveLength(1);
                }

                const packageFile = result.contents.find((item: StructureEntry) => item.name === 'package.json');
                expect(packageFile).toBeDefined();
                if (packageFile && isFile(packageFile)) {
                    expect(packageFile.type).toBe('file');
                    expect(packageFile.size).toBe(1000);
                }

                expect(cache.set).toHaveBeenCalledWith('structure:facebook/react::3', result);
            }
        });

        it('should respect the maxDepth parameter', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock content response for root directory
            mockRestClient.repos.getContent.mockResolvedValueOnce({
                data: [
                    {
                        name: 'src',
                        path: 'src',
                        type: 'dir',
                        size: 0
                    }
                ]
            });

            // Act
            const result = await getRepositoryStructure('facebook', 'react', '', 1);

            // Assert
            expect(cache.get).toHaveBeenCalledWith('structure:facebook/react::1');

            // Check that we don't recurse beyond maxDepth
            if (isDirectory(result)) {
                const srcDir = result.contents.find((item: StructureEntry) => item.name === 'src');
                expect(srcDir).toBeDefined();
                if (srcDir && isDirectory(srcDir)) {
                    expect(srcDir.type).toBe('dir');
                    expect(srcDir.contents).toHaveLength(0); // Empty at max depth
                }
            }
        });

        it('should handle getting structure for a specific path', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock content response for specific path
            mockRestClient.repos.getContent.mockResolvedValueOnce({
                data: [
                    {
                        name: 'index.js',
                        path: 'src/index.js',
                        type: 'file',
                        size: 500
                    }
                ]
            });

            // Act
            const result = await getRepositoryStructure('facebook', 'react', 'src');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('structure:facebook/react:src:3');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'src',
                ref: 'main'
            });

            expect(result.name).toBe('src');
            expect(result.path).toBe('src');

            if (isDirectory(result)) {
                expect(result.contents).toHaveLength(1);
            }
        });

        it('should throw error when path is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = new Error('Not found');
            (notFoundError as any).status = 404;
            mockRestClient.repos.getContent.mockRejectedValue(notFoundError);

            // Act & Assert
            await expect(getRepositoryStructure('facebook', 'react', 'nonexistent')).rejects.toThrow('Path not found');
        });

        it('should handle case when getting a file instead of directory', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock content response for a file
            mockRestClient.repos.getContent.mockResolvedValueOnce({
                data: {
                    name: 'package.json',
                    path: 'package.json',
                    type: 'file',
                    size: 1000
                }
            });

            // Act
            const result = await getRepositoryStructure('facebook', 'react', 'package.json');

            // Assert
            expect(result.type).toBe('file');
            expect(result.name).toBe('package.json');

            if (isFile(result)) {
                expect(result.size).toBe(1000);
            }
        });
    });

    describe('getRepositoryFiles', () => {
        it('should return cached files list if available', async () => {
            // Arrange
            const cachedFiles = ['src/index.js', 'package.json', 'README.md'];
            vi.mocked(cache.get).mockReturnValue(cachedFiles);

            // Act
            const result = await getRepositoryFiles('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('repo-files:facebook/react:all');
            expect(mockRestClient.git.getTree).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(cachedFiles);
        });

        it('should fetch repository files when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock git tree response
            mockRestClient.git.getTree.mockResolvedValue({
                data: {
                    tree: [
                        {
                            type: 'blob',
                            path: 'package.json',
                            size: 1000
                        },
                        {
                            type: 'blob',
                            path: 'src/index.js',
                            size: 500
                        },
                        {
                            type: 'tree',
                            path: 'src',
                            size: 0
                        }
                    ]
                }
            });

            // Act
            const result = await getRepositoryFiles('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('repo-files:facebook/react:all');
            expect(mockGetRepository).toHaveBeenCalledWith('facebook', 'react');
            expect(mockRestClient.git.getTree).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                tree_sha: 'main',
                recursive: '1'
            });

            // Check files list
            expect(result).toHaveLength(2); // Only blob types, not tree
            expect(result).toContain('package.json');
            expect(result).toContain('src/index.js');
            expect(result).not.toContain('src'); // Directories excluded

            expect(cache.set).toHaveBeenCalledWith('repo-files:facebook/react:all', result);
        });

        it('should filter files by extension when specified', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock git tree response
            mockRestClient.git.getTree.mockResolvedValue({
                data: {
                    tree: [
                        {
                            type: 'blob',
                            path: 'package.json',
                            size: 1000
                        },
                        {
                            type: 'blob',
                            path: 'src/index.js',
                            size: 500
                        },
                        {
                            type: 'blob',
                            path: 'src/Component.jsx',
                            size: 700
                        },
                        {
                            type: 'blob',
                            path: 'README.md',
                            size: 2000
                        }
                    ]
                }
            });

            // Act
            const result = await getRepositoryFiles('facebook', 'react', 'js');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('repo-files:facebook/react:js');
            expect(result).toHaveLength(1); // Only .js files
            expect(result).toContain('src/index.js');
            expect(result).not.toContain('package.json');
            expect(result).not.toContain('src/Component.jsx');
        });

        it('should handle GitHub API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.git.getTree.mockRejectedValue(new Error('API rate limit exceeded'));

            // Act & Assert
            await expect(getRepositoryFiles('facebook', 'react')).rejects.toThrow('GitHub API error');
        });
    });
});
