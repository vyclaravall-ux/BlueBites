# GitHub Pages Deployment Guide

This guide will help you deploy the Blue Bites website to GitHub Pages.

## Prerequisites

- A GitHub account
- Git installed on your computer
- All project files in the `windsurf-project` folder

## Step-by-Step Deployment

### 1. Initialize Git Repository (if not already done)

Open your terminal/command prompt in the project folder and run:

```bash
cd c:\Users\akavi\CascadeProjects\windsurf-project
git init
```

### 2. Add All Files

```bash
git add .
```

### 3. Create Initial Commit

```bash
git commit -m "Initial commit: Blue Bites campus dining platform"
```

### 4. Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Name your repository (e.g., `blue-bites` or `campus-dining`)
4. Choose **Public** (required for free GitHub Pages)
5. **Do NOT** initialize with README (we already have one)
6. Click **"Create repository"**

### 5. Link Local Repository to GitHub

Copy the commands shown on GitHub's "Quick setup" page, or run:

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` and `YOUR-REPO-NAME` with your actual GitHub username and repository name.

### 6. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (tab at the top)
3. Scroll down to **Pages** in the left sidebar
4. Under **"Build and deployment"**:
   - **Source**: Deploy from a branch
   - **Branch**: Select `main` (or `master`)
   - **Folder**: Select `/ (root)`
5. Click **Save**

### 7. Wait for Deployment

- GitHub will start building your site
- This takes 1-3 minutes
- A green checkmark will appear when ready
- Your site URL will be displayed: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Common Issues and Solutions

### Issue 1: 404 Error - "File not found"

**Solution**: Make sure you have the `.nojekyll` file in your repository root. This file is already included in the project.

```bash
# Verify the file exists
ls -la .nojekyll  # Mac/Linux
dir .nojekyll     # Windows
```

### Issue 2: Styles Not Loading

**Cause**: Incorrect file paths or case sensitivity

**Solution**: All file references in the HTML files use relative paths (e.g., `./styles.css`, `./script.js`). These should work correctly. Verify all filenames match exactly (case-sensitive on Linux servers).

### Issue 3: JSON Data Not Loading

**Cause**: The `food_stalls_master_2025-10-30.json` file is not in the `assets/` folder.

**Solution**: Verify the file structure:
```
assets/
  ├── eagle.svg
  └── food_stalls_master_2025-10-30.json
```

### Issue 4: Changes Not Showing Up

**Solution**: GitHub Pages caches aggressively. Try:

1. **Hard refresh** your browser: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear cache** in your browser settings
3. **Wait a few minutes** for GitHub's CDN to update
4. **Check deployment status**: Go to repository → Actions tab

### Issue 5: Repository Is Private

**Solution**: GitHub Pages requires a public repository (for free accounts).

1. Go to Settings → General
2. Scroll to the bottom → "Danger Zone"
3. Click "Change visibility" → "Make public"

## Updating Your Site

When you make changes to your local files:

```bash
git add .
git commit -m "Description of changes"
git push
```

GitHub Pages will automatically rebuild your site (takes 1-3 minutes).

## Custom Domain (Optional)

If you want to use a custom domain (e.g., `bluebites.com`):

1. Buy a domain from a registrar (GoDaddy, Namecheap, etc.)
2. Go to repository Settings → Pages
3. Under "Custom domain", enter your domain
4. Update your domain's DNS settings to point to GitHub Pages:
   - Add a CNAME record pointing to `YOUR-USERNAME.github.io`
   - Or add A records pointing to GitHub's IPs

See [GitHub's custom domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) for details.

## Testing Locally Before Deploying

Always test changes locally first:

```bash
# Using Python
python -m http.server 8000

# OR using Node.js
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

## Repository Structure Check

Before deploying, verify this structure:

```
windsurf-project/
├── .gitattributes        ✓ (for proper line endings)
├── .gitignore            ✓ (excludes unnecessary files)
├── .nojekyll             ✓ (disables Jekyll)
├── README.md             ✓ (repository documentation)
├── DEPLOYMENT.md         ✓ (this file)
├── index.html            ✓ (REQUIRED - landing page)
├── map.html              ✓
├── shop.html             ✓
├── product.html          ✓
├── budget.html           ✓
├── profile.html          ✓
├── login.html            ✓
├── objectives.html       ✓
├── styles.css            ✓
├── script.js             ✓
├── assets/
│   ├── eagle.svg         ✓
│   └── food_stalls_master_2025-10-30.json  ✓
└── eagle logo.png        (optional)
```

## Support

If you encounter issues:

1. Check the [GitHub Pages documentation](https://docs.github.com/en/pages)
2. Review your repository's Actions tab for build errors
3. Ensure all files have been committed and pushed
4. Verify your repository is public

## Quick Deployment Checklist

- [ ] Git repository initialized
- [ ] All files committed
- [ ] Repository created on GitHub
- [ ] Code pushed to GitHub
- [ ] Repository is public
- [ ] GitHub Pages enabled in Settings
- [ ] `.nojekyll` file present in root
- [ ] `index.html` exists in root
- [ ] Waited 2-3 minutes for initial deployment
- [ ] Site accessible at GitHub Pages URL

---

**Your site should now be live!** 🎉

Share your URL: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`
