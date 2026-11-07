# 🚀 Reshad Ul Karim - Personal Portfolio Website

A modern, minimalistic personal portfolio website showcasing AI & Robotics expertise, research publications, and professional experience.

## ✨ Features

### 🎨 Design & UX
- **Minimalistic Design** - Clean, professional layout with modern aesthetics
- **Responsive Layout** - Optimized for all devices (desktop, tablet, mobile)
- **Dark/Light Theme** - Toggle between themes with persistent preference
- **Smooth Animations** - AOS (Animate On Scroll) library integration
- **Parallax Effects** - Engaging scroll-based animations
- **Interactive Elements** - Hover effects and micro-interactions

### 🛠️ Technical Features
- **Vanilla JavaScript** - No framework dependencies, pure performance
- **CSS3 Grid & Flexbox** - Modern layout techniques
- **CSS Custom Properties** - Maintainable theming system
- **Particles.js Background** - Interactive particle system
- **Form Validation** - Client-side validation with user feedback
- **SEO Optimized** - Meta tags, semantic HTML, and accessibility
- **Performance Optimized** - Lazy loading, throttled scroll events

### 📱 Interactive Components
- **Mobile Navigation** - Hamburger menu with smooth transitions
- **Typing Effect** - Dynamic text animation in hero section
- **Contact Form** - Functional form with validation and feedback
- **Scroll Indicators** - Visual feedback for page navigation
- **Loading Screen** - Professional loading animation
- **Easter Egg** - Hidden Konami code surprise 🎮

## 🏗️ Project Structure

```
MyWebsite/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and animations
├── script.js           # JavaScript functionality
├── README.md           # Original profile README
└── README_WEBSITE.md   # This file
```

## 🚀 Quick Start

### 1. Local Development

1. **Clone or download** the project files
2. **Open** `index.html` in your browser
3. **That's it!** The website runs entirely in the browser

### 2. Live Server (Recommended)

For better development experience:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (if you have live-server installed)
npx live-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 🌐 GitHub Pages Deployment

### Step 1: Create Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `your-username.github.io` (replace with your actual username)
3. Make sure it's **public**

### Step 2: Upload Files

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit: Personal portfolio website"

# Add remote origin
git remote add origin https://github.com/your-username/your-username.github.io.git

# Push to GitHub
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**

### Step 4: Access Your Website

Your website will be available at: `https://your-username.github.io`

⏰ **Note**: It may take a few minutes for the site to be live.

## 🎨 Customization Guide

### 1. Personal Information

Edit `index.html` to update:
- Name and title
- Contact information
- Social media links
- Experience details
- Project information
- Research publications

### 2. Styling

Edit `styles.css` to customize:
- Color scheme (CSS custom properties in `:root`)
- Typography (font families and sizes)
- Spacing and layout
- Animation timings

### 3. Functionality

Edit `script.js` to modify:
- Typing effect texts
- Particles.js configuration
- Form submission logic
- Animation behaviors

## 🎯 Key Sections

### Hero Section
- Dynamic typing effect
- Professional statistics
- Call-to-action buttons
- Animated floating icons

### About Section
- Personal introduction
- Skills categorization
- Education information
- Interactive skill tags

### Experience Section
- Timeline layout
- Professional achievements
- Company information
- Responsive design

### Projects Section
- Project showcases
- Technology tags
- Live demo links
- GitHub repositories

### Research Section
- Publication listings
- Research statistics
- Academic achievements
- External links

### Contact Section
- Contact form
- Contact information
- Social media links
- Form validation

## 🔧 Technical Details

### Dependencies
- **Font Awesome** - Icons
- **Google Fonts** - Typography (Inter, JetBrains Mono)
- **AOS** - Scroll animations
- **Particles.js** - Background effects

### Browser Support
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

### Performance
- Optimized images
- Minified external libraries
- Throttled scroll events
- Lazy loading support

## 📱 Mobile Optimization

- Responsive breakpoints
- Touch-friendly interactions
- Mobile navigation menu
- Optimized typography scaling
- Performance considerations

## 🎨 Color Scheme

```css
/* Primary Colors */
--primary-color: #6366f1    /* Indigo */
--secondary-color: #ec4899  /* Pink */
--accent-color: #06b6d4     /* Cyan */

/* Text Colors */
--text-primary: #1f2937     /* Dark Gray */
--text-secondary: #6b7280   /* Medium Gray */
--text-light: #9ca3af       /* Light Gray */

/* Background Colors */
--bg-primary: #ffffff       /* White */
--bg-secondary: #f9fafb     /* Light Gray */
--bg-dark: #111827          /* Dark */
```

## 🚀 Performance Tips

1. **Optimize Images**: Use WebP format when possible
2. **Minimize HTTP Requests**: Combine CSS/JS files for production
3. **Enable Compression**: Use gzip compression on server
4. **CDN Usage**: Consider using CDN for external libraries
5. **Caching**: Implement proper caching headers

## 🔒 Security Considerations

- Form validation (client-side only - implement server-side for production)
- Content Security Policy headers
- HTTPS enforcement
- Input sanitization

## 🐛 Troubleshooting

### Common Issues

1. **Particles not showing**: Check browser console for JavaScript errors
2. **Animations not working**: Ensure AOS library is loaded
3. **Mobile menu not working**: Check JavaScript console for errors
4. **Form not submitting**: Currently shows demo - implement backend

### Debug Mode

Add this to browser console for debugging:
```javascript
// Enable debug mode
localStorage.setItem('debug', 'true');
location.reload();
```

## 📈 Analytics & SEO

### SEO Features
- Semantic HTML structure
- Meta tags for social sharing
- Structured data markup ready
- Sitemap.xml ready
- Robots.txt ready

### Analytics Integration
Ready for:
- Google Analytics
- Google Search Console
- Social media pixels
- Heat mapping tools

## 🤝 Contributing

Feel free to:
1. Report bugs
2. Suggest improvements
3. Submit pull requests
4. Share feedback

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Design Inspiration**: Modern portfolio trends
- **Libraries Used**: AOS, Particles.js, Font Awesome
- **Icons**: Font Awesome
- **Fonts**: Google Fonts

## 📞 Support

If you need help with setup or customization:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the code comments

---

**Built with ❤️ by Reshad Ul Karim**

*Turning research prototypes into production solutions, one algorithm at a time.* 
## 🔧 Maintenance: media lifecycle, quality tiers and checks

- **Hero 3D** (`home-scene.js`): one WebGL renderer drawing only the portrait, its glass-shard ring, dust and arcs, on a canvas inside `.hero__gl`. It starts after `load` + idle, renders on demand, stops while the hero is off screen or the tab is hidden, and keeps the `<img>` portrait for no WebGL 2, Save-Data, forced colours or a lost context. Every other section uses CSS/SVG motion; do not add more renderers.
- **React islands** (`islands/` → built into `assets/islands/`): seven React Bits components mounted into `[data-island]` placeholders on the homepage: Gooey Nav (desktop nav), Tech Text (hero name), Scanner (hero background), Splash Cursor (desktop fine pointers only), Profile Card (About), Card Swap (projects) and Flying Button (assistant buttons). Every placeholder holds working static HTML, React loads only with the first island after `load` + idle, and each component is its own chunk. Rebuild after editing anything in `islands/src/`: `cd islands && npm install && npm run build` (also stamps the `?v=` on the script in `index.html`); commit `assets/islands/`. The hero's **Pause motion** button (`hero-motion.js`, `localStorage.motion`) stops Scanner, the name sweep and the project autoplay; reduced motion does the same and skips the fluid cursor. Research-card motifs animate only on the hovered/focused card (touch: the card most in view).
- **Quality tier** (`perf-tier.js`): decided once at load (Save-Data / reduced data, ≤2 GB or ≤2 cores, or ≤4 GB and ≤4 cores → `html.perf-lite`) and never switched mid-visit. Lite keeps the same layout and glass recipe; it only drops backdrop blur on secondary glass, SVG refraction, and lowers the 3D pixel budget (1.5×, ~1.1 MP).
- **Glass vs satin**: `liquid-glass.js` tags only navigation, buttons and floating widgets. Cards and long text use the satin tokens in `tokens.css` (`--surface-*`).
- **Images**: after adding a project image run `python3 tools/make_card_thumbs.py` (writes `-640w.webp` card derivatives); after editing any CSS run `python3 tools/build_css_bundles.py`. Bump the `?v=` of any edited script (the service worker caches versioned files forever) and `VERSION` in `sw.js` when cached assets are removed.
- **Checks**: serve the folder (`python3 -m http.server 8000`), then run Lighthouse mobile and desktop on `/`, `/projects/`, a project page and `/publications/` (`npx lighthouse <url> [--preset=desktop]`), and check the viewport range 320 px to 2560 px for horizontal overflow, the projects search/filter/Back behaviour, reduced motion, and the no-WebGL fallback (`--disable-webgl`).
