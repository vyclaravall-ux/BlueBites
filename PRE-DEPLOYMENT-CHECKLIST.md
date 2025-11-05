# Pre-Deployment Checklist for GitHub Pages

Use this checklist before deploying to GitHub Pages to ensure everything works correctly.

## ✅ File Structure

- [x] `index.html` exists in root directory (REQUIRED)
- [x] `.nojekyll` file exists in root (tells GitHub to skip Jekyll processing)
- [x] `.gitignore` is configured
- [x] `.gitattributes` is configured (for proper line endings)
- [x] `README.md` exists
- [x] All HTML files are in root directory
- [x] `assets/` folder contains:
  - [x] `eagle.svg` (logo)
  - [x] `food_stalls_master_2025-10-30.json` (data file)

## ✅ HTML Files Verification

All paths in HTML files use **relative paths** (starting with `./`):

- [x] `<link rel="stylesheet" href="./styles.css" />`
- [x] `<script src="./script.js"></script>`
- [x] `<img src="./assets/eagle.svg" />`
- [x] Links between pages use relative paths (e.g., `href="index.html"`)

## ✅ Required Files Present

- [x] `index.html` - Landing page
- [x] `map.html` - Campus map
- [x] `shop.html` - Menu filtering
- [x] `product.html` - Product details
- [x] `budget.html` - Budget tracker
- [x] `profile.html` - User profile
- [x] `login.html` - Authentication
- [x] `objectives.html` - Project objectives
- [x] `styles.css` - Stylesheet
- [x] `script.js` - JavaScript functionality

## ✅ Git Repository Setup

Run these commands to verify:

```bash
# Check if git is initialized
git status

# Should show: "On branch main" or "On branch master"
# If you get "fatal: not a git repository", run: git init
```

## ✅ Before First Push

- [ ] Run `git add .` to stage all files
- [ ] Run `git commit -m "Initial commit"` to create first commit
- [ ] Create repository on GitHub.com
- [ ] Make sure repository is **PUBLIC** (required for free GitHub Pages)
- [ ] Run `git remote add origin https://github.com/USERNAME/REPO.git`
- [ ] Run `git push -u origin main`

## ✅ GitHub Pages Configuration

After pushing to GitHub:

- [ ] Go to repository Settings → Pages
- [ ] Set **Source** to "Deploy from a branch"
- [ ] Set **Branch** to `main` (or `master`)
- [ ] Set **Folder** to `/ (root)`
- [ ] Click **Save**
- [ ] Wait 2-3 minutes for deployment
- [ ] Check the green checkmark appears
- [ ] Visit your site at: `https://USERNAME.github.io/REPO-NAME/`

## ✅ Common Issues to Check

### Issue: 404 Error

- [ ] Verify `index.html` is in root directory
- [ ] Verify `.nojekyll` file exists
- [ ] Verify repository is PUBLIC
- [ ] Wait a few minutes and hard refresh (Ctrl+F5)

### Issue: Styles Not Loading

- [ ] Check browser console for errors (F12)
- [ ] Verify `styles.css` is in root directory
- [ ] Verify all `<link>` tags use `./styles.css`
- [ ] Hard refresh browser (Ctrl+F5)

### Issue: JavaScript Not Working

- [ ] Check browser console for errors (F12)
- [ ] Verify `script.js` is in root directory
- [ ] Verify all `<script>` tags use `./script.js`
- [ ] Hard refresh browser (Ctrl+F5)

### Issue: Images Not Loading

- [ ] Verify `assets/` folder exists in root
- [ ] Verify `eagle.svg` is in `assets/` folder
- [ ] Verify all image references use `./assets/filename`

### Issue: JSON Data Not Loading

- [ ] Verify `food_stalls_master_2025-10-30.json` is in `assets/` folder
- [ ] Check browser console for fetch errors
- [ ] Verify file is valid JSON (no syntax errors)

## ✅ Local Testing Before Deployment

Always test locally first:

```bash
# Using Python 3
python -m http.server 8000

# OR using Node.js http-server
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser and test:

- [ ] Home page loads correctly
- [ ] Navigation works between all pages
- [ ] Styles are applied correctly
- [ ] JavaScript functions work
- [ ] Images load correctly
- [ ] Map displays (if you have internet connection)
- [ ] Menu items load and display
- [ ] Product page shows details when clicking items
- [ ] Filters work on shop page
- [ ] Login/logout works
- [ ] Profile page works
- [ ] Budget tracker functions correctly

## ✅ Post-Deployment Verification

After GitHub Pages is live:

- [ ] Visit your GitHub Pages URL
- [ ] Test all navigation links
- [ ] Test all interactive features
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices
- [ ] Check browser console for errors (F12 → Console)
- [ ] Verify all images load
- [ ] Verify all styles apply
- [ ] Verify JavaScript works

## 🎯 Final Step

Once everything is verified and working:

- [ ] Share your live URL: `https://USERNAME.github.io/REPO-NAME/`
- [ ] Update `README.md` with the live site URL
- [ ] Consider adding a custom domain (optional)

## 📝 Quick Deployment Commands

```bash
# If starting fresh:
cd c:\Users\akavi\CascadeProjects\windsurf-project
git init
git add .
git commit -m "Initial commit: Blue Bites campus dining platform"

# Replace USERNAME and REPO-NAME with your actual values:
git remote add origin https://github.com/USERNAME/REPO-NAME.git
git branch -M main
git push -u origin main

# For updates after initial deployment:
git add .
git commit -m "Description of changes"
git push
```

## 🆘 Need Help?

- See `DEPLOYMENT.md` for detailed instructions
- Check [GitHub Pages documentation](https://docs.github.com/en/pages)
- Review repository Actions tab for build errors
- Check repository Settings → Pages for deployment status

---

**Ready to deploy?** Run `deploy-setup.bat` (Windows) to automate the setup process!
