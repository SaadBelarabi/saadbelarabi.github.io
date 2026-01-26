document.addEventListener('DOMContentLoaded', function() {
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';
  overlay.innerHTML = '<img src="" alt="">';
  document.body.appendChild(overlay);

  const overlayImg = overlay.querySelector('img');

  // Add click handlers to all post images
  const postImages = document.querySelectorAll('.post-content img, article img');
  
  postImages.forEach(function(img) {
    img.classList.add('zoomable-image');
    
    img.addEventListener('click', function() {
      overlayImg.src = this.src;
      overlayImg.alt = this.alt;
      overlay.classList.add('active');
    });
  });

  // Close overlay when clicked
  overlay.addEventListener('click', function() {
    overlay.classList.remove('active');
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      overlay.classList.remove('active');
    }
  });
});