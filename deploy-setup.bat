@echo off
REM Blue Bites - GitHub Pages Deployment Setup Script
REM This script helps initialize your repository and prepare for deployment

echo ========================================
echo   Blue Bites Deployment Setup
echo ========================================
echo.

REM Check if Git is installed
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo Step 1: Checking current directory...
echo Current directory: %CD%
echo.

REM Check if already a git repository
if exist ".git" (
    echo Git repository already initialized.
    echo.
) else (
    echo Initializing Git repository...
    git init
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to initialize Git repository
        pause
        exit /b 1
    )
    echo Git repository initialized successfully!
    echo.
)

echo Step 2: Checking required files...
if not exist "index.html" (
    echo WARNING: index.html not found!
    echo This file is REQUIRED for GitHub Pages.
) else (
    echo ✓ index.html found
)

if not exist ".nojekyll" (
    echo WARNING: .nojekyll file not found!
    echo Creating .nojekyll file...
    type nul > .nojekyll
    echo ✓ .nojekyll file created
) else (
    echo ✓ .nojekyll found
)

if not exist "assets\food_stalls_master_2025-10-30.json" (
    echo WARNING: Food data JSON not found in assets folder
) else (
    echo ✓ Food data JSON found
)

if not exist "README.md" (
    echo WARNING: README.md not found
) else (
    echo ✓ README.md found
)
echo.

echo Step 3: Adding files to Git...
git add .
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to add files
    pause
    exit /b 1
)
echo Files added successfully!
echo.

echo Step 4: Creating initial commit...
git status
echo.
set /p CONFIRM="Do you want to create the initial commit? (y/n): "
if /i "%CONFIRM%" NEQ "y" (
    echo Commit cancelled. You can commit manually later.
    goto :skip_commit
)

git commit -m "Initial commit: Blue Bites campus dining platform"
if %ERRORLEVEL% NEQ 0 (
    echo Note: Commit may have failed if there are no changes.
    echo This is okay if you've already committed before.
) else (
    echo Commit created successfully!
)
echo.

:skip_commit

echo Step 5: Repository setup...
echo.
echo Next, you need to:
echo 1. Create a repository on GitHub.com
echo 2. Run these commands (replace YOUR-USERNAME and REPO-NAME):
echo.
echo    git remote add origin https://github.com/YOUR-USERNAME/REPO-NAME.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. Enable GitHub Pages in repository Settings → Pages
echo 4. Set Source to "Deploy from branch"
echo 5. Select "main" branch and "/ (root)" folder
echo.
echo See DEPLOYMENT.md for detailed instructions!
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Your project is ready for GitHub deployment.
echo Open DEPLOYMENT.md for the complete guide.
echo.
pause
