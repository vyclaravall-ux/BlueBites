# Blue Bites

A digital meal listing and comparison platform designed for Atenean students to discover, compare, and plan their campus dining experience.

## 🍽️ Features

- **Interactive Map**: View all food stalls across campus locations (Gonzaga, JSEC, ISO, New Rizal Library)
- **Menu Filtering**: Filter meals by budget, preparation time, dietary restrictions (Halal, Pork-free), and allergens
- **Product Details**: View comprehensive information about each food item including price, ingredients, and allergens
- **Budget Tracker**: Track your spending and manage your meal budget
- **Favorites**: Save your favorite meals for quick access
- **User Profiles**: Personalized experience with login functionality

## 🚀 Live Demo

Visit the live site: [Your GitHub Pages URL will be here]

## 📁 Project Structure

```
windsurf-project/
├── index.html          # Landing page
├── map.html           # Interactive campus map
├── shop.html          # Menu filtering and browsing
├── product.html       # Individual product details
├── budget.html        # Budget tracking
├── profile.html       # User profile
├── login.html         # Authentication
├── objectives.html    # Project objectives
├── styles.css         # Main stylesheet
├── script.js          # Application logic
├── assets/
│   ├── eagle.svg      # Logo
│   └── food_stalls_master_2025-10-30.json  # Food data
└── .nojekyll         # Disable Jekyll processing

```

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Maps**: Leaflet.js for interactive campus maps
- **Data Storage**: LocalStorage for user preferences and favorites
- **Hosting**: GitHub Pages

## 📦 Deployment

### GitHub Pages Setup

1. Push all files to your GitHub repository
2. Go to repository Settings → Pages
3. Under "Build and deployment":
   - Source: Deploy from a branch
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
4. Click Save
5. Wait 1-2 minutes for deployment
6. Your site will be available at: `https://[username].github.io/[repository-name]/`

### Local Development

1. Clone the repository:
   ```bash
   git clone [your-repo-url]
   cd windsurf-project
   ```

2. Start a local server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # OR using Node.js
   npx http-server -p 8000
   ```

3. Open `http://localhost:8000` in your browser

## 📝 Data Sources

- Food stall data is stored in `assets/food_stalls_master_2025-10-30.json`
- The app can also integrate with Google Sheets for dynamic data (see `script.js` for configuration)

## 🔧 Configuration

To use Google Sheets integration:

1. Open `script.js`
2. Update the `SHEETS_CFG` object:
   ```javascript
   const SHEETS_CFG = {
     id: 'YOUR_GOOGLE_SHEET_ID',
     stallsSheet: 'Stalls',
     menuSheet: 'Menu'
   };
   ```
3. Publish your Google Sheet to the web (File → Share → Publish to web)

## 🤝 Contributing

This is a student project for Ateneo de Manila University. For questions or suggestions, use the contact form on the homepage.

## 📄 License

This project is created for educational purposes.

## 👥 Team

Created by the Blue Bites team at Ateneo de Manila University.
