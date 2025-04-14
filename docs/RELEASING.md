# Release Process for GitCP

This document outlines the process for creating new releases of GitCP and publishing them to npm.

## Prerequisites

- GitHub access with permission to create releases on the repository
- NPM account with publish access (configured via GitHub secrets)

## Creating a New Release

1. **Ensure the code is ready for release**
    - All tests are passing
    - Documentation is up to date
    - Features and bug fixes are complete

2. **Create a new GitHub Release**
    - Go to the GitHub repository
    - Click on "Releases" in the right sidebar
    - Click "Draft a new release"
    - Create a new tag in the format `v1.2.3` (following [semver](https://semver.org/))
    - Set the release title (usually the same as the tag)
    - Add release notes detailing changes, new features, and bug fixes
    - Click "Publish release"

3. **Automated Release Process**
    - Once you publish the release, the GitHub Actions workflow will:
        - Check out the code
        - Update the version in package.json to match the release tag
        - Run tests and linting
        - Build the project
        - Publish to npm

4. **Verify the Release**
    - Check that the GitHub Actions workflow completed successfully
    - Verify the package is available on npm (`npm view gitcp`)
    - Test installation and execution via npx: `npx gitcp --help`

## Version Guidelines

Follow semantic versioning for releases:

- **Major version** (`1.0.0`): Breaking changes that require users to update their code
- **Minor version** (`0.1.0`): New features that don't break compatibility
- **Patch version** (`0.0.1`): Bug fixes and minor improvements

## Hotfixes

For urgent fixes:

1. Fix the issue on a branch created from the latest release tag
2. Test thoroughly
3. Create a new release with an incremented patch version
4. After publishing, ensure the fix is also merged into the main branch

## Release Checklist

- [ ] All tests pass
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated (if applicable)
- [ ] Version number follows semantic versioning
- [ ] Release notes are comprehensive
- [ ] GitHub release is created with the proper tag
- [ ] GitHub Actions workflow completes successfully
- [ ] Package is available on npm
- [ ] Package can be executed via npx
