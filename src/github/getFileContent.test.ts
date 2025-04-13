// src/github/getFileContent.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFileContent, getRawFileContent } from './getFileContent';
import { resetGitHubTestEnvironment } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Sample base64 encoded content
const sampleContent = 'Sample file content for testing';
const base64Content = Buffer.from(sampleContent).toString('base64');

// Mock fetch for raw content
vi.stubGlobal('fetch', vi.fn());

// Mock the REST client
vi.mock('./utils/client.js', () => {
    const mockRestClient = {
        repos: {
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

describe('File Content Retrieval', () => {
    // REST client mock
    let mockRestClient: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Reset fetch mock
        vi.mocked(fetch).mockReset();

        // Get reference to the mocked REST client
        mockRestClient = require('./utils/client.js').getRESTClientSingleton();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getFileContent', () => {
        it('should return cached file content if available', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(sampleContent);

            // Act
            const result = await getFileContent('facebook', 'react', 'package.json');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('file:facebook/react:package.json');
            expect(mockRestClient.repos.getContent).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(sampleContent);
        });

        it('should fetch file content from GitHub API when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: {
                    type: 'file',
                    content: base64Content
                }
            });

            // Act
            const result = await getFileContent('facebook', 'react', 'package.json');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('file:facebook/react:package.json');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'package.json',
                ref: undefined
            });
            expect(cache.set).toHaveBeenCalledWith('file:facebook/react:package.json', sampleContent);
            expect(result).toEqual(sampleContent);
        });

        it('should support getting content from a specific branch/ref', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: {
                    type: 'file',
                    content: base64Content
                }
            });

            // Act
            const result = await getFileContent('facebook', 'react', 'package.json', 'experimental');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('file:facebook/react:package.json:experimental');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'package.json',
                ref: 'experimental'
            });
            expect(result).toEqual(sampleContent);
        });

        it('should throw error when path points to a directory, not a file', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: [] // Array response indicates a directory
            });

            // Act & Assert
            await expect(getFileContent('facebook', 'react', 'src')).rejects.toThrow('Path does not point to a file');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });

        it('should throw specific error when file is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = new Error('Not found');
            (notFoundError as any).status = 404;
            mockRestClient.repos.getContent.mockRejectedValue(notFoundError);

            // Act & Assert
            await expect(getFileContent('facebook', 'react', 'nonexistent.js')).rejects.toThrow('File not found');
        });

        it('should throw error for other API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const apiError = new Error('Rate limit exceeded');
            mockRestClient.repos.getContent.mockRejectedValue(apiError);

            // Act & Assert
            await expect(getFileContent('facebook', 'react', 'package.json')).rejects.toThrow('GitHub API error');
        });
    });

    describe('getRawFileContent', () => {
        it('should return cached raw file content if available', async () => {
            // Arrange
            const sampleBuffer = Buffer.from(sampleContent);
            vi.mocked(cache.get).mockReturnValue(sampleBuffer);

            // Act
            const result = await getRawFileContent('facebook', 'react', 'package.json');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('raw-file:facebook/react:package.json:main');
            expect(fetch).not.toHaveBeenCalled(); // fetch not called when cache hit
            expect(result).toEqual(sampleBuffer);
        });

        it('should fetch raw file content directly when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock fetch response
            const mockResponse = {
                ok: true,
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(sampleContent.length)),
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as any);

            // Act
            const result = await getRawFileContent('facebook', 'react', 'package.json');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('raw-file:facebook/react:package.json:main');
            expect(fetch).toHaveBeenCalledWith('https://raw.githubusercontent.com/facebook/react/main/package.json');
            expect(mockResponse.arrayBuffer).toHaveBeenCalled();
            expect(result).toBeInstanceOf(Buffer);
            expect(cache.set).toHaveBeenCalled();
        });

        it('should support specifying a custom ref/branch', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock fetch response
            const mockResponse = {
                ok: true,
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(sampleContent.length)),
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as any);

            // Act
            const result = await getRawFileContent('facebook', 'react', 'package.json', 'experimental');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('raw-file:facebook/react:package.json:experimental');
            expect(fetch).toHaveBeenCalledWith('https://raw.githubusercontent.com/facebook/react/experimental/package.json');
        });

        it('should only cache small files (< 1MB)', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Create a large buffer (> 1MB)
            const largeBuffer = Buffer.alloc(1.1 * 1024 * 1024); // 1.1 MB

            // Mock fetch response
            const mockResponse = {
                ok: true,
                arrayBuffer: vi.fn().mockResolvedValue(largeBuffer.buffer),
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as any);

            // Act
            await getRawFileContent('facebook', 'react', 'large-file.bin');

            // Assert
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache large files
        });

        it('should throw error when HTTP request fails', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock fetch response for failure
            const mockResponse = {
                ok: false,
                status: 404,
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as any);

            // Act & Assert
            await expect(getRawFileContent('facebook', 'react', 'nonexistent.js')).rejects.toThrow('HTTP error! Status: 404');
        });

        it('should throw error for network failures', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

            // Act & Assert
            await expect(getRawFileContent('facebook', 'react', 'package.json')).rejects.toThrow('Failed to fetch raw file');
        });
    });
});
