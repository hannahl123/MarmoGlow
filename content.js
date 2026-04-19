(function() {
  // Theme Toggle Implementation
  const storageKey = 'marmoglow-theme';

  function setTheme(theme) {
    console.log('[MarmoGlow] Setting theme to:', theme);
    document.documentElement.setAttribute('data-theme', theme);
    chrome.storage.local.set({ [storageKey]: theme });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }

  // Fetch and display scores
  async function fetchScores() {
    const allLinks = Array.from(document.querySelectorAll('a'));
    const viewLinks = allLinks.filter(a => a.textContent.trim().toLowerCase() === 'view');
    
    console.log(`[MarmoGlow] Found ${viewLinks.length} view links to check.`);
    
    viewLinks.forEach(async (link) => {
      try {
        const fetchUrl = link.href + (link.href.includes('?') ? '&' : '?') + 't=' + Date.now();
        const response = await fetch(fetchUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const firstRow = doc.querySelector('tr.r0, tr.r1');
        if (firstRow) {
          const cells = Array.from(firstRow.querySelectorAll('td'));
          let scoreText = cells[2] ? cells[2].textContent.trim() : null;
          
          if (!scoreText || scoreText === '') {
             const testingMatch = doc.body.textContent.toLowerCase().includes('testing');
             scoreText = testingMatch ? 'Testing...' : 'No Score';
          }

          if (scoreText) {
            console.log(`[MarmoGlow] Score for ${link.href}: ${scoreText}`);
            const scoreBadge = document.createElement('span');
            scoreBadge.className = 'marmoglow-score';
            scoreBadge.textContent = scoreText;

            const lowerScore = scoreText.toLowerCase();

            if (scoreText.includes('/')) {
              const parts = scoreText.split('/');
              const got = parseInt(parts[0].trim());
              const total = parseInt(parts[1].trim());
              if (got === total && total > 0) {
                scoreBadge.classList.add('passed');
              } else if (got < total || got === 0) {
                scoreBadge.classList.add('failed');
              }
            } else if (lowerScore.includes('error')) {
              scoreBadge.classList.add('error');
            } else if (lowerScore.includes('fail')) {
              scoreBadge.classList.add('failed');
            } else if (lowerScore.includes('pass')) {
              scoreBadge.classList.add('passed');
            } else if (scoreText === 'Testing...') {
              scoreBadge.classList.add('testing');
            }

            link.innerHTML = 'view ';
            link.appendChild(scoreBadge);
          }        }
      } catch (e) {
        console.error('[MarmoGlow] Failed to fetch score for:', link.href, e);
      }
    });
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
    
    // Load scores
    fetchScores();
  }

  // Wait for body to be available
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
