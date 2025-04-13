// src/github/getReadmeContent.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getReadmeContent, getReadmeContentByPath } from './getReadmeContent';
import { resetGitHubTestEnvironment, sampleReadmeContent } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Sample base64 encoded content
const base64Content = Buffer.from(sampleReadmeContent).toString('base64');

// Mock the REST client
vi.mock('./utils/client.js', () => {
    const mockRestClient = {
        repos: {
            getReadme: vi.fn(),
            getContent: vi.fn()
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

describe('README Content Retrieval', () => {
    // REST client mock
    let mockRestClient: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Get reference to the mocked REST client
        mockRestClient = require('./utils/client.js').getRESTClientSingleton();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getReadmeContent', () => {
        it('should return cached README content if available', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(sampleReadmeContent);

            // Act
            const result = await getReadmeContent('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme:facebook/react');
            expect(mockRestClient.repos.getReadme).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should fetch README content from GitHub API when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getReadme.mockResolvedValue({
                data: {
                    content: base64Content
                }
            });

            // Act
            const result = await getReadmeContent('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme:facebook/react');
            expect(mockRestClient.repos.getReadme).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react'
            });
            expect(cache.set).toHaveBeenCalledWith('readme:facebook/react', sampleReadmeContent);
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should return null when README is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = new Error('Not found');
            (notFoundError as any).status = 404;
            mockRestClient.repos.getReadme.mockRejectedValue(notFoundError);

            // Act
            const result = await getReadmeContent('facebook', 'react');

            // Assert
            expect(result).toBeNull();
            expect(cache.set).toHaveBeenCalledWith('readme:facebook/react', null);
        });

        it('should throw error for other API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const apiError = new Error('Rate limit exceeded');
            mockRestClient.repos.getReadme.mockRejectedValue(apiError);

            // Act & Assert
            await expect(getReadmeContent('facebook', 'react')).rejects.toThrow('GitHub API error');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });
    });

    describe('getReadmeContentByPath', () => {
        it('should return cached README content if available', async () => {
            // Arrange
            const customPath = 'docs/README.md';
            vi.mocked(cache.get).mockReturnValue(sampleReadmeContent);

            // Act
            const result = await getReadmeContentByPath('facebook', 'react', customPath);

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme-path:facebook/react:docs/README.md');
            expect(mockRestClient.repos.getContent).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should fetch README content by path from GitHub API when not cached', async () => {
            // Arrange
            const customPath = 'docs/README.md';
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: {
                    type: 'file',
                    content: base64Content
                }
            });

            // Act
            const result = await getReadmeContentByPath('facebook', 'react', customPath);

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme-path:facebook/react:docs/README.md');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: customPath
            });
            expect(cache.set).toHaveBeenCalledWith('readme-path:facebook/react:docs/README.md', sampleReadmeContent);
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should throw error when path points to a directory, not a file', async () => {
            // Arrange
            const dirPath = 'docs';
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: [] // Array response indicates a directory
            });

            // Act & Assert
            await expect(getReadmeContentByPath('facebook', 'react', dirPath)).rejects.toThrow('Path does not point to a file');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });

        it('should return null when README path is not found', async () => {
            // Arrange
            const nonExistentPath = 'docs/NONEXISTENT.md';
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = new Error('Not found');
            (notFoundError as any).status = 404;
            mockRestClient.repos.getContent.mockRejectedValue(notFoundError);

            // Act
            const result = await getReadmeContentByPath('facebook', 'react', nonExistentPath);

            // Assert
            expect(result).toBeNull();
            expect(cache.set).toHaveBeenCalledWith('readme-path:facebook/react:docs/NONEXISTENT.md', null);
        });
    });
});
