// Select your dropdown, form, and dropdown toggle elements
const dropdownContent = document.querySelector('.filter-dropdown-list');
const form = document.querySelector('.expeditions_filter-form'); // Update with your form class
const dropdownToggle = document.querySelector('.filter-dropdown-toggle'); // Update with your toggle button class

// Function to close the dropdown
function closeDropdown() {
  // Webflow adds 'w--open' class to both toggle and dropdown content when open
  dropdownToggle.classList.remove('w--open');
  dropdownContent.classList.remove('w--open');
}

// Listen for clicks on the document
document.addEventListener('click', function(event) {
  // Check if the click was outside both the dropdown content and form
  const isClickInsideDropdown = dropdownContent.contains(event.target);
  const isClickInsideForm = form.contains(event.target);
  const isClickOnToggle = dropdownToggle.contains(event.target);
  
  // Don't close if clicking inside dropdown, on form, or on toggle (toggle has its own behavior)
  if (!isClickInsideDropdown && !isClickInsideForm && !isClickOnToggle) {
    closeDropdown();
    console.log('Closing dropdown - clicked outside');
  }
});
