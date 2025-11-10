document.addEventListener('DOMContentLoaded', function() {
  // Initialize the star rating system
  const stars = document.querySelectorAll('.rating-input .star');
  let selectedRating = 0;

  // Add click event listeners to stars
  stars.forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.getAttribute('data-rating'));
      selectedRating = rating;
      
      // Update star display
      stars.forEach((s, index) => {
        if (index < rating) {
          s.textContent = '★';
          s.classList.add('active');
        } else {
          s.textContent = '☆';
          s.classList.remove('active');
        }
      });
    });

    // Add hover effect
    star.addEventListener('mouseover', function() {
      const rating = parseInt(this.getAttribute('data-rating'));
      highlightStars(rating);
    });

    star.addEventListener('mouseout', function() {
      highlightStars(selectedRating);
    });
  });

  function highlightStars(count) {
    stars.forEach((star, index) => {
      if (index < count) {
        star.textContent = '★';
      } else {
        star.textContent = '☆';
      }
    });
  }

  // Handle review form submission
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (selectedRating === 0) {
        alert('Please select a rating');
        return;
      }

      const name = document.getElementById('reviewerName').value.trim();
      const title = document.getElementById('reviewTitle').value.trim();
      const text = document.getElementById('reviewText').value.trim();

      if (!name || !title || !text) {
        alert('Please fill in all fields');
        return;
      }

      // Create a new review element
      const reviewCard = document.createElement('div');
      reviewCard.className = 'review-card';
      
      // Get current date in a readable format
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      const currentDate = new Date().toLocaleDateString('en-US', options);
      
      // Generate initials for avatar
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
      
      // Create stars HTML
      let starsHtml = '';
      for (let i = 0; i < 5; i++) {
        starsHtml += i < selectedRating ? '★' : '☆';
      }
      
      // Set the review card HTML
      reviewCard.innerHTML = `
        <div class="review-header">
          <div class="reviewer">
            <div class="avatar" style="background-color: ${getRandomColor()}">${initials}</div>
            <div>
              <div class="reviewer-name">${name}</div>
              <div class="review-date">Just now</div>
            </div>
          </div>
          <div class="stars">${starsHtml}</div>
        </div>
        <h4 class="review-title">${title}</h4>
        <p class="review-text">${text}</p>
        <div class="review-helpful">
          <span>Helpful? </span>
          <button class="helpful-btn">Yes (0)</button>
          <button class="helpful-btn">No (0)</button>
        </div>
      `;

      // Add the new review to the top of the reviews grid
      const reviewsGrid = document.querySelector('.reviews-grid');
      if (reviewsGrid) {
        reviewsGrid.insertBefore(reviewCard, reviewsGrid.firstChild);
      }

      // Update the review count
      updateReviewCount(1);

      // Reset the form
      reviewForm.reset();
      selectedRating = 0;
      stars.forEach(star => {
        star.textContent = '☆';
        star.classList.remove('active');
      });

      // Show success message
      alert('Thank you for your review!');
    });
  }

  // Helper function to generate a random color for avatars
  function getRandomColor() {
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Update the review count in the header
  function updateReviewCount(count) {
    const reviewCountElement = document.querySelector('.review-count');
    if (reviewCountElement) {
      const currentCount = parseInt(reviewCountElement.textContent.match(/\d+/)[0]);
      const newCount = currentCount + count;
      reviewCountElement.textContent = `Based on ${newCount} review${newCount !== 1 ? 's' : ''}`;
    }
  }

  // Handle helpful button clicks
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('helpful-btn')) {
      const button = e.target;
      const text = button.textContent;
      const count = parseInt(text.match(/\(\d+\)/)[0].replace(/[()]/g, '')) || 0;
      
      // Toggle active state
      const isActive = button.classList.toggle('active');
      
      // Update the count
      if (isActive) {
        button.textContent = text.replace(/\(\d+\)/, `(${count + 1})`);
      } else {
        button.textContent = text.replace(/\(\d+\)/, `(${Math.max(0, count - 1)})`);
      }
    }
  });
});
