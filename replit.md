# DOCX Viewer

## Overview
A browser-based DOCX file viewer and explorer that allows users to:
- Upload and view .docx files
- Navigate the internal file structure of DOCX files (which are ZIP archives)
- View XML, images, and other content within DOCX files
- Edit XML content with syntax highlighting using Monaco Editor
- Recent files history stored in IndexedDB

## Project Architecture
- **Type**: Static web application (frontend-only)
- **Tech Stack**:
  - Pure HTML/CSS/JavaScript
  - JSZip for ZIP file handling
  - Monaco Editor for code editing
  - IndexedDB for local storage
- **No Build Process**: Runs directly in the browser
- **No Backend**: All processing happens client-side

## Files
- `index.html` - Main application file (all-in-one: HTML, CSS, JavaScript)
- `.replit` - Replit configuration
- `package-lock.json` - Empty package lock file

## Recent Changes
- **2025-10-23**: Initial import from GitHub
- **2025-10-23**: Configured for Replit environment with static HTTP server

## Deployment
- Uses Python's built-in HTTP server for serving static files
- Runs on port 5000 (Replit standard)
