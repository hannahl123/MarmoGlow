(function() {
  // Theme Toggle Implementation
  const storageKey = 'marmoglow-theme';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    chrome.storage.local.set({ [storageKey]: theme });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }

  function init() {
    // Load saved theme
    chrome.storage.local.get([storageKey], (result) => {
      const savedTheme = result[storageKey];
      if (savedTheme) {
        setTheme(savedTheme);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    });

    // Create Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'marmoglow-toggle';
    toggleBtn.title = 'Toggle Theme';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7-7 1.5 1.5-7 7-1.5-1.5z"/>
      </svg>
    `;
    toggleBtn.addEventListener('click', toggleTheme);
    document.body.appendChild(toggleBtn);
  }

  // Wait for body to be available
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
