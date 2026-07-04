const searchInput = document.querySelector('[data-user-search]');

if (searchInput) {
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      searchInput.form.requestSubmit();
    }
  });
}
