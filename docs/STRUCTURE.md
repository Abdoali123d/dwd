# DWD Project Structure Documentation

This document provides a comprehensive overview of the DWD project's file and folder structure.

## Root Directory
- **`index.html`**: The main entry point (Login Page). Contains the 3D space animation and login logic.
- **`home.html`**: The main dashboard/landing page after login.
- **`server.js`**: Node.js backend server. Handles:
  - API endpoints for user data (`/api/data`).
  - AI Chat endpoints (`/api/chat`).
  - Dynamic password updates (`/api/update-password`).
  - Serves static files.
- **`style.css`**: Global styles (deprecated/less used favor of specific CSS files).
- **`package.json`**: Project dependencies and scripts.

## /DWD (Content Modules)
This directory contains the core subsystems of the "Digital World Design" platform.
- **`profile/`**: User profile management page (`index.html`).
- **`materials/`**: Stores educational resources (PDFs, PPTs) and the logic to display them.
- **`schedule/`**: University schedule viewing page.
- **`exams/`**: Exams and results interface.
- **`communication/`**: Chat or messaging features (if active).
- **`Ai-Nano/`**: A sub-project (likely React-based) for the AI assistant "Nano".
- **`downloads/`**: Section for downloading lectures and assignments.
- **`auth-guard.js`**: (Note: Check if this exists here or in `/js`) - Script to protect internal routes.

## /js (Core Logic)
Centralized JavaScript files for the application.
- **`script.js`**: 
  - Handles client-side logic for `index.html`.
  - Syncs `server.js` user data to `localStorage`.
  - Fallback authentication logic.
- **`supabase_auth_helper.js`**:
  - Primary Authentication Handler.
  - Connects to Supabase for Login/Logout.
  - Manages User Sessions in `localStorage`.
- **`auth-guard.js`**:
  - Validates user sessions on every page load.
  - Redirects unauthenticated users to `index.html`.
- **`content-protection.js`**:
  - Security script (e.g., preventing right-click/copy). Currently disabled/empty.
- **`spa-navigation.js`**:
  - Configuration for `Swup.js` to enable Single Page Application transitions.

## /css (Styling)
- **`spa-transitions.css`**: Defines animations for page transitions (fade, slide).

## /data
- Stores static JSON data files if used (e.g., backups of user lists or schedules).

## /sql
- Database scripts and backups for Supabase or local SQL testing.

## System Flow
1. **Login**: User enters credentials -> `supabase_auth_helper.js` checks Supabase (or falls back to Local) -> Redirects to `home.html`.
2. **Data**: User data is synced from `server.js` API to Browser `localStorage` on load.
3. **Protection**: `auth-guard.js` runs on every internal page to ensure security.
