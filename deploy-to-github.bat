@echo off
REM Blue Bites - Quick GitHub Deployment Script
echo ========================================
echo   Blue Bites - GitHub Deployment
echo ========================================
echo.

echo This script will help you deploy to GitHub Pages
echo.
echo Prerequisites:
echo - Git installed
echo - GitHub account created
echo - Repository created on GitHub.com
echo.
pause

echo.
echo Step 1: Checking Git...
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git not found!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)
echo Git found!

echo.
echo Step 2: Initialize repository (if needed)...
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo Repository initialized!
) else (
    echo Repository already initialized.
)

echo.
echo Step 3: Add all files...
git add .
echo Files staged for commit.

echo.
echo Step 4: Create commit...
git commit -m "Deploy Blue Bites to GitHub Pages"
if %ERRORLEVEL% NEQ 0 (
    echo No changes to commit or already committed.
)

echo.
echo Step 5: Link to GitHub repository
echo.
echo IMPORTANT: Have you created a repository on GitHub.com?
echo If not, go to https://github.com/new and create one now.
echo Make sure it's PUBLIC (required for free GitHub Pages)
echo.
set /p GITHUB_URL="Enter your repository URL (e.g., https://github.com/username/repo.git): "

if "%GITHUB_URL%"=="" (
    echo ERROR: No URL provided
    pause
    exit /b 1
)

echo.
echo Adding remote origin...
git remote remove origin 2>nul
git remote add origin %GITHUB_URL%

echo.
echo Step 6: Push to GitHub...
git branch -M main
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Push failed!
    echo Make sure:
    echo 1. Repository exists on GitHub
    echo 2. You're logged into Git (run: git config --global user.name "Your Name")
    echo 3. Repository URL is correct
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS! Code pushed to GitHub
echo ========================================
echo.
echo Next steps:
echo 1. Go to your repository on GitHub
echo 2. Click Settings → Pages
echo 3. Under "Build and deployment":
echo    - Source: Deploy from a branch
echo    - Branch: main
echo    - Folder: / (root)
echo 4. Click Save
echo 5. Wait 2-3 minutes
echo.
echo Your site will be live at:
echo https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
echo.
echo See GITHUB-DEPLOYMENT-READY.md for details!
echo.
pause
