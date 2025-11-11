/* =========================================================================
   Prompt Store - script.js
   Reads ./prompt_store_content.xlsx and renders all sections dynamically.
   Also: loads display-only Community Custom GPTs from ./data/custom_gpts.xlsx
   ========================================================================= */

/* ------------------------------ Config ---------------------------------- */

// Always resolves to docs/prompt_store_content.xlsx relative to index.html,
// and works on GitHub Pages subpaths.
const EXCEL_URL = new URL('prompt_store_content.xlsx', document.baseURI).href;

// NEW: default source for Community Custom GPTs
const CUSTOM_GPTS_URL = new URL('custom_gpts.xlsx', document.baseURI).href;

/* ------------------------------ State ----------------------------------- */

let theoryModules = [];
let techniques = [];
let useCases = [];
let bestPractices = [];
let commonMistakes = [];
let faqs = [];

let currentSection = 'home';
let searchIndex = [];

// NEW: Custom GPTs state (display-only)
let customGPTs = [];
let gptSelectedTags = new Set();
let gptQuery = "";

/* -------------------------- Utilities / Loader --------------------------- */

function parsePipe(str) {
  return (str || '')
    .split(/[|,]/) // support both pipe and comma
    .map(s => s.trim())
    .filter(Boolean);
}

function ensureXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const s = document.createElement('script');
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
}

function sheetJson(wb, name) {
  const sh = wb.Sheets?.[name];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json(sh, { defval: '' });
}

function firstSheetJson(wb) {
  const first = wb.SheetNames?.[0];
  if (!first) return [];
  return sheetJson(wb, first);
}

function buildTheory(modRows, secRows) {
  const map = new Map();
  modRows.forEach(r => {
    map.set(+r.id, { id: +r.id, title: r.title, description: r.description, content: [] });
  });
  secRows
    .slice()
    .sort((a,b) => (a.module_id - b.module_id) || (a.order - b.order))
    .forEach(r => {
      const m = map.get(+r.module_id);
      if (!m) return;
      m.content.push({
        heading: r.heading,
        text: r.text,
        points: parsePipe(r.points)
      });
    });
  return Array.from(map.values()).sort((a,b)=>a.id-b.id);
}

function buildTechniques(rows) {
  return rows
    .slice()
    .sort((a,b)=> (+a.id) - (+b.id))
    .map(r => ({
      id: +r.id,
      name: r.name,
      category: r.category,
      difficulty: r.difficulty,
      description: r.description,
      when_to_use: r.when_to_use,
      example_prompt: r.example_prompt,
      expected_output: r.expected_output,
      pros: parsePipe(r.pros),
      cons: parsePipe(r.cons),
      amex_example: r.amex_example
    }));
}

function buildUseCases(rows) {
  return rows
    .slice()
    .sort((a,b)=> (+a.id) - (+b.id))
    .map(r => ({
      id: +r.id,
      category: r.category,
      title: r.title,
      business_context: r.business_context,
      template_prompt: r.template_prompt,
      example_prompt_1: r.example_prompt_1,
      example_output_1: r.example_output_1,
      customization_points: parsePipe(r.customization_points),
      success_metrics: parsePipe(r.success_metrics)
    }));
}

function buildBestPractices(rows) {
  return rows
    .slice()
    .sort((a,b)=> (+a.id) - (+b.id))
    .map(r => ({
      id: +r.id,
      category: r.category,
      title: r.title,
      explanation: r.explanation,
      before: r.before,
      after: r.after,
      amex_example: r.amex_example,
      impact: r.impact
    }));
}

function buildSimple(rows) { return rows; }

async function loadExcelFromUrl(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Excel fetch failed');
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const mods = sheetJson(wb, 'TheoryModules');
  const secs = sheetJson(wb, 'TheorySections');
  const tech = sheetJson(wb, 'Techniques');
  const ucs  = sheetJson(wb, 'UseCases');
  const bp   = sheetJson(wb, 'BestPractices');
  const cm   = sheetJson(wb, 'CommonMistakes');
  const fq   = sheetJson(wb, 'FAQs');

  theoryModules   = buildTheory(mods, secs);
  techniques      = buildTechniques(tech);
  useCases        = buildUseCases(ucs);
  bestPractices   = buildBestPractices(bp);
  commonMistakes  = buildSimple(cm);
  faqs            = buildSimple(fq);
}

function showUploadBanner() {
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position: fixed; left: 50%; transform: translateX(-50%);
    top: 16px; z-index: 2000; background: var(--color-surface);
    border: 1px solid var(--color-border); border-radius: 10px;
    padding: 12px 16px; box-shadow: var(--shadow-lg); display:flex; gap:12px; align-items:center;
  `;
  wrap.innerHTML = `
    <strong>Load content:</strong>
    <input type="file" accept=".xlsx" id="excelUpload" style="font-size:12px" />
    <span style="font-size:12px;color:var(--color-text-secondary)">Select <em>prompt_store_content.xlsx</em></span>
  `;
  document.body.appendChild(wrap);

  const input = wrap.querySelector('#excelUpload');
  input.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: 'array' });

      const mods = sheetJson(wb, 'TheoryModules');
      const secs = sheetJson(wb, 'TheorySections');
      const tech = sheetJson(wb, 'Techniques');
      const ucs  = sheetJson(wb, 'UseCases');
      const bp   = sheetJson(wb, 'BestPractices');
      const cm   = sheetJson(wb, 'CommonMistakes');
      const fq   = sheetJson(wb, 'FAQs');

      theoryModules   = buildTheory(mods, secs);
      techniques      = buildTechniques(tech);
      useCases        = buildUseCases(ucs);
      bestPractices   = buildBestPractices(bp);
      commonMistakes  = buildSimple(cm);
      faqs            = buildSimple(fq);

      afterDataLoaded();
      wrap.remove();
    };
    reader.readAsArrayBuffer(f);
  });
}

/* ---------------------- Community Custom GPTs Loader --------------------- */

// Try common sheet names, fall back to first sheet
function getCustomGPTRows(wb) {
  const candidates = ['CustomGPTs', 'GPTs', 'custom_gpts', 'Sheet1'];
  for (const name of candidates) {
    const rows = sheetJson(wb, name);
    if (rows.length) return rows;
  }
  return firstSheetJson(wb);
}

// Normalize rows with flexible column names.
function normalizeCustomGPTRow(r) {
  const title = r.title || r.Title || r.name || r.Name || r['GPT Title'] || '';
  const description = r.description || r.Description || r.summary || r.Summary || '';
  const author = r.author || r.Author || r.created_by || r.Publisher || '';
  const url = r.url || r.URL || r.link || r.Link || r.href || '';
  const emoji = r.icon || r.Icon || r.emoji || r.Emoji || '';
  const tags = parsePipe(r.tags || r.Tags || r.category || r.Category || '');
  const updated = r.updated_at || r.updated || r.Updated || r['Last Updated'] || '';
  const visibility = r.visibility || r.Visibility || 'public';

  return { title, description, author, url, emoji, tags, updated, visibility };
}

async function loadCustomGPTsFromUrl(url) {
  const errEl = document.getElementById('gpt-error');
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const raw = getCustomGPTRows(wb);
    customGPTs = raw.map(normalizeCustomGPTRow).filter(x => x.title);
    afterCustomGPTsLoaded();
  } catch (e) {
    console.warn(e);
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = `Could not load Custom GPTs from "${url}". Use "Upload .xlsx" to load locally.`;
    }
    // keep UI usable; users can upload their own file
    customGPTs = [];
    afterCustomGPTsLoaded();
  }
}

/* --------------------------- Navigation / UI ----------------------------- */

function initializeNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav-link');
  const breadcrumbLinks = document.querySelectorAll('.breadcrumb-link');
  const navCards = document.querySelectorAll('[data-navigate]');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      navigateToSection(section);
    });
  });

  breadcrumbLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      navigateToSection(section);
    });
  });

  navCards.forEach(card => {
    card.addEventListener('click', () => {
      const section = card.getAttribute('data-navigate');
      navigateToSection(section);
    });
  });
}

function navigateToSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(section)?.classList.remove('hidden');

  document.querySelectorAll('.sidebar-nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-section') === section) link.classList.add('active');
  });

  window.scrollTo(0, 0);
  currentSection = section;
}

/* ------------------------------- Search --------------------------------- */

function buildSearchIndex() {
  searchIndex = [];

  theoryModules.forEach(module => {
    searchIndex.push({
      title: module.title,
      description: module.description,
      category: 'Theory',
      section: 'theory',
      keywords: [module.title.toLowerCase(), module.description.toLowerCase()]
    });
  });

  techniques.forEach(technique => {
    searchIndex.push({
      title: technique.name,
      description: technique.description,
      category: 'Technique',
      section: 'techniques',
      keywords: [technique.name.toLowerCase(), technique.description.toLowerCase(), (technique.category||'').toLowerCase()]
    });
  });

  useCases.forEach(useCase => {
    searchIndex.push({
      title: useCase.title,
      description: useCase.business_context,
      category: useCase.category,
      section: 'use-cases',
      keywords: [useCase.title.toLowerCase(), useCase.category.toLowerCase(), useCase.business_context.toLowerCase()]
    });
  });

  const doItems = bestPractices.filter(p => p.category === 'DO');
  const dontItems = bestPractices.filter(p => p.category === "DON'T");
  [...doItems, ...dontItems].forEach(practice => {
    searchIndex.push({
      title: practice.title,
      description: practice.explanation,
      category: 'Best Practice',
      section: 'best-practices',
      keywords: [practice.title.toLowerCase(), practice.explanation.toLowerCase()]
    });
  });

  faqs.forEach(faq => {
    searchIndex.push({
      title: faq.q,
      description: faq.a,
      category: 'FAQ',
      section: 'faq',
      keywords: [faq.q.toLowerCase(), faq.a.toLowerCase()]
    });
  });

  // NEW: Include Custom GPTs in global search
  customGPTs.forEach(g => {
    searchIndex.push({
      title: g.title,
      description: g.description,
      category: 'Custom GPT',
      section: 'community-gpts',
      keywords: [
        g.title.toLowerCase(),
        (g.description || '').toLowerCase(),
        (g.author || '').toLowerCase(),
        ...(g.tags || []).map(t => t.toLowerCase())
      ]
    });
  });
}

function initializeSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    const results = searchIndex.filter(item =>
      item.keywords.some(keyword => keyword.includes(query))
    ).slice(0, 8);

    if (results.length > 0) {
      renderSearchResults(results);
      searchResults.classList.remove('hidden');
    } else {
      searchResults.innerHTML = '<div class="search-result-item"><div class="search-result-title">No results found</div></div>';
      searchResults.classList.remove('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });
}

function renderSearchResults(results) {
  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = results.map(result => `
    <div class="search-result-item" onclick="navigateToSection('${result.section}'); document.getElementById('searchResults').classList.add('hidden');">
      <div class="search-result-title">${result.title}</div>
      <div class="search-result-description">${result.description.substring(0, 100)}...</div>
      <div class="search-result-category">${result.category}</div>
    </div>
  `).join('');
}

/* ------------------------------- Renderers ------------------------------- */

// Theory
function renderTheorySection() {
  const accordion = document.getElementById('theoryAccordion');
  if (!accordion) return;
  accordion.innerHTML = theoryModules.map(module => `
    <div class="accordion-item">
      <div class="accordion-header">
        <h3 class="accordion-title">${module.title}</h3>
        <svg class="accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
      <div class="accordion-content">
        <p class="accordion-description">${module.description}</p>
        ${module.content.map(section => `
          <div class="accordion-section">
            <h4>${section.heading}</h4>
            ${section.text ? `<p>${section.text}</p>` : ''}
            ${section.points?.length ? `<ul>${section.points.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Techniques
function renderTechniquesSection() {
  const techniquesList = document.getElementById('techniquesList');
  if (!techniquesList) return;

  techniquesList.innerHTML = techniques.map(technique => `
    <div class="technique-card">
      <div class="technique-header">
        <div>
          <h3 class="technique-title">${technique.name}</h3>
          <span class="technique-badge">${technique.difficulty}</span>
        </div>
      </div>
      <p class="technique-description">${technique.description}</p>
      <div class="technique-section">
        <h5>When to Use</h5>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${technique.when_to_use}</p>
      </div>
      <div class="technique-section">
        <h5>Example Prompt</h5>
        <div class="code-block">
          <button class="copy-btn" onclick="copyToClipboard(this, \`${(technique.example_prompt||'').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">Copy</button>
          <pre style="margin:0; white-space: pre-wrap; word-wrap: break-word;">${technique.example_prompt || ''}</pre>
        </div>
      </div>
      <div class="technique-section">
        <h5>Expected Output</h5>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); font-style: italic;">${technique.expected_output || ''}</p>
      </div>
      <div class="pros-cons">
        <div class="pros">
          <h6>Pros</h6>
          <ul>${(technique.pros||[]).map(pro => `<li>${pro}</li>`).join('')}</ul>
        </div>
        <div class="cons">
          <h6>Cons</h6>
          <ul>${(technique.cons||[]).map(con => `<li>${con}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="technique-section">
        <h5>Amex Example Use Case</h5>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${technique.amex_example || ''}</p>
      </div>
    </div>
  `).join('');
}

// Use Cases
function renderUseCasesSection() {
  const useCasesList = document.getElementById('useCasesList');
  if (!useCasesList) return;

  useCasesList.innerHTML = useCases.map(useCase => `
    <div class="use-case-card" data-category="${useCase.category.toLowerCase().replace(/ /g, '-')}">
      <span class="use-case-category">${useCase.category}</span>
      <h3 class="use-case-title">${useCase.title}</h3>

      <div class="use-case-context">
        <div class="use-case-context-title">Business Context</div>
        <div class="use-case-context-text">${useCase.business_context}</div>
      </div>

      <div class="example-section">
        <div class="example-title">Template Prompt</div>
        <div class="code-block">
          <button class="copy-btn" onclick="copyToClipboard(this, \`${(useCase.template_prompt||'').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">Copy</button>
          <pre style="margin:0; white-space: pre-wrap; word-wrap: break-word;">${useCase.template_prompt||''}</pre>
        </div>
      </div>

      <div class="example-section">
        <div class="example-title">Example Prompt</div>
        <div class="code-block">
          <button class="copy-btn" onclick="copyToClipboard(this, \`${(useCase.example_prompt_1||'').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">Copy</button>
          <pre style="margin:0; white-space: pre-wrap; word-wrap: break-word;">${useCase.example_prompt_1||''}</pre>
        </div>
      </div>

      <div class="example-section">
        <div class="example-title">Expected Output</div>
        <div style="background-color: var(--color-bg-3); padding: var(--space-16); border-radius: var(--radius-base); font-size: var(--font-size-sm); color: var(--color-text-secondary); white-space: pre-wrap;">${useCase.example_output_1||''}</div>
      </div>

      <div class="example-section">
        <div class="example-title">Customization Points</div>
        <ul style="list-style: none; padding-left: 0;">
          ${(useCase.customization_points||[]).map(point => `<li style="font-size: var(--font-size-sm); color: var(--color-text-secondary); padding-left: var(--space-20); position: relative; margin-bottom: var(--space-6);"><span style="position: absolute; left: 0; color: var(--color-primary); font-weight: bold;">→</span>${point}</li>`).join('')}
        </ul>
      </div>

      <div class="example-section">
        <div class="example-title">Success Metrics</div>
        <ul style="list-style: none; padding-left: 0;">
          ${(useCase.success_metrics||[]).map(metric => `<li style="font-size: var(--font-size-sm); color: var(--color-text-secondary); padding-left: var(--space-20); position: relative; margin-bottom: var(--space-6);"><span style="position: absolute; left: 0; color: var(--color-success); font-weight: bold;">✓</span>${metric}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
}

// Best Practices + Common Mistakes
function renderBestPracticesSection() {
  const doPractices = bestPractices.filter(p => p.category === 'DO');
  const dontPractices = bestPractices.filter(p => p.category === "DON'T");

  const doEl = document.getElementById('bestPracticesDo');
  const dontEl = document.getElementById('bestPracticesDont');
  const cmEl = document.getElementById('commonMistakes');

  if (doEl) {
    doEl.innerHTML = doPractices.map(practice => `
      <div class="practice-card">
        <div class="practice-header">
          <div class="practice-icon">✅</div>
          <h3 class="practice-title">${practice.title}</h3>
        </div>
        <p style="font-size: var(--font-size-base); color: var(--color-text-secondary); margin-bottom: var(--space-16);">${practice.explanation}</p>
        <div class="comparison">
          <div class="before">
            <h6>Before</h6>
            <code>${practice.before}</code>
          </div>
          <div class="after">
            <h6>After</h6>
            <code>${practice.after}</code>
          </div>
        </div>
        <div style="background-color: var(--color-bg-1); padding: var(--space-12); border-radius: var(--radius-base); margin-bottom: var(--space-12);">
          <strong style="font-size: var(--font-size-sm);">Amex Example:</strong>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-4) 0 0 0;">${practice.amex_example}</p>
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--color-primary); font-weight: var(--font-weight-medium);">
          Impact: ${practice.impact}
        </div>
      </div>
    `).join('');
  }

  if (dontEl) {
    dontEl.innerHTML = dontPractices.map(practice => `
      <div class="practice-card">
        <div class="practice-header">
          <div class="practice-icon">❌</div>
          <h3 class="practice-title">${practice.title}</h3>
        </div>
        <p style="font-size: var(--font-size-base); color: var(--color-text-secondary); margin-bottom: var(--space-16);">${practice.explanation}</p>
        <div class="comparison">
          <div class="before">
            <h6>Bad Example</h6>
            <code>${practice.before}</code>
          </div>
          <div class="after">
            <h6>Good Example</h6>
            <code>${practice.after}</code>
          </div>
        </div>
        <div style="background-color: var(--color-bg-1); padding: var(--space-12); border-radius: var(--radius-base); margin-bottom: var(--space-12);">
          <strong style="font-size: var(--font-size-sm);">Amex Example:</strong>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-4) 0 0 0;">${practice.amex_example}</p>
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--color-primary); font-weight: var(--font-weight-medium);">
          Impact: ${practice.impact}
        </div>
      </div>
    `).join('');
  }

  if (cmEl) {
    cmEl.innerHTML = commonMistakes.map(mistake => `
      <div class="practice-card">
        <div class="practice-header">
          <div class="practice-icon">⚠️</div>
          <h3 class="practice-title">${mistake.title}</h3>
        </div>
        <p style="font-size: var(--font-size-base); color: var(--color-text-secondary); margin-bottom: var(--space-16);">${mistake.description}</p>
        <div style="background-color: var(--color-bg-4); padding: var(--space-12); border-radius: var(--radius-base); margin-bottom: var(--space-12);">
          <strong style="font-size: var(--font-size-sm);">Problem Example:</strong>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-4) 0 0 0;">${mistake.example}</p>
        </div>
        <div style="background-color: var(--color-bg-3); padding: var(--space-12); border-radius: var(--radius-base);">
          <strong style="font-size: var(--font-size-sm);">Solution:</strong>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-4) 0 0 0;">${mistake.solution}</p>
        </div>
      </div>
    `).join('');
  }
}

// Prompt Library
function renderPromptLibrary() {
  const libraryList = document.getElementById('promptLibraryList');
  if (!libraryList) return;

  const allPrompts = [...techniques, ...useCases];

  libraryList.innerHTML = allPrompts.map(item => {
    const isUseCase = Object.prototype.hasOwnProperty.call(item, 'business_context');
    const difficulty = (item.difficulty || 'intermediate').toLowerCase();
    const category = (item.category || '').toLowerCase().replace(/ /g, '-');
    const label = isUseCase ? (item.category || '') : (item.difficulty || '');
    const showText = isUseCase ? (item.template_prompt || '') : (item.example_prompt || '');

    return `
      <div class="technique-card" data-difficulty="${difficulty}" data-category="${category}">
        <div class="technique-header">
          <div>
            <h3 class="technique-title">${item.name || item.title}</h3>
            <span class="technique-badge">${label}</span>
          </div>
        </div>
        <p class="technique-description">${(item.description || item.business_context || '')}</p>
        <div class="technique-section">
          <h5>${isUseCase ? 'Template Prompt' : 'Example Prompt'}</h5>
          <div class="code-block">
            <button class="copy-btn" onclick="copyToClipboard(this, \`${(showText).replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">Copy</button>
            <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${showText}</pre>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// FAQ
function renderFAQSection() {
  const faqList = document.getElementById('faqList');
  if (!faqList) return;

  faqList.innerHTML = faqs.map(faq => `
    <div class="faq-item">
      <div class="faq-question">${faq.q}</div>
      <div class="faq-answer">${faq.a}</div>
      <span class="faq-tag">${faq.relevance}</span>
    </div>
  `).join('');
}

/* ---------------------- Community Custom GPTs UI ------------------------- */

function uniqueSortedTags(items) {
  const map = new Map(); // tag -> count
  items.forEach(it => (it.tags || []).forEach(t => {
    const k = t.trim();
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  }));
  return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
}

function renderGPTTags() {
  const tagsEl = document.getElementById('gpt-tags');
  if (!tagsEl) return;
  const tags = uniqueSortedTags(customGPTs);

  tagsEl.innerHTML = tags.map(([tag, count]) => `
    <button class="tag ${gptSelectedTags.has(tag) ? 'active' : ''}" data-tag="${tag}" aria-pressed="${gptSelectedTags.has(tag)}">
      #${tag} <span class="tag-count">${count}</span>
    </button>
  `).join('');

  tagsEl.querySelectorAll('.tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-tag');
      if (gptSelectedTags.has(t)) gptSelectedTags.delete(t);
      else gptSelectedTags.add(t);
      btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', btn.classList.contains('active'));
      applyGPTFilters();
    });
  });
}

function renderGPTGrid(items = customGPTs) {
  const grid = document.getElementById('gpt-grid');
  const empty = document.getElementById('gpt-empty');
  if (!grid || !empty) return;

  if (!items.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = items.map(g => `
    <article class="gpt-card" tabindex="0">
      <div class="gpt-card-header">
        <div class="gpt-icon">${g.emoji || '🤖'}</div>
        <div class="gpt-title-wrap">
          <h3 class="gpt-title">${g.title}</h3>
          ${g.author ? `<div class="gpt-meta">by <span class="gpt-author">${g.author}</span>${g.updated ? ` • <span class="gpt-updated">${g.updated}</span>` : ''}</div>` : ''}
        </div>
      </div>
      <p class="gpt-desc">${g.description || ''}</p>
      ${(g.tags && g.tags.length) ? `<div class="gpt-tags">${g.tags.map(t => `<span class="gpt-tag">#${t}</span>`).join('')}</div>` : ''}
      <div class="gpt-actions">
        ${g.url ? `<a class="btn btn-primary" href="${g.url}" target="_blank" rel="noopener">Open</a>` : `<button class="btn btn-secondary" disabled>Link unavailable</button>`}
      </div>
    </article>
  `).join('');
}

function applyGPTFilters() {
  const q = gptQuery.toLowerCase().trim();
  const hasTags = gptSelectedTags.size > 0;
  const filtered = customGPTs.filter(g => {
    const matchesQ = !q ||
      (g.title && g.title.toLowerCase().includes(q)) ||
      (g.description && g.description.toLowerCase().includes(q)) ||
      (g.author && g.author.toLowerCase().includes(q)) ||
      (g.tags || []).some(t => t.toLowerCase().includes(q));

    const matchesTags = !hasTags ||
      (g.tags || []).some(t => gptSelectedTags.has(t));

    return matchesQ && matchesTags;
  });

  renderGPTGrid(filtered);
}

function initializeCustomGPTsUI() {
  const input = document.getElementById('gpt-file-input');
  const refresh = document.getElementById('gpt-refresh');
  const search = document.getElementById('gpt-search');

  if (search) {
    search.addEventListener('input', (e) => {
      gptQuery = e.target.value || '';
      applyGPTFilters();
    });
  }

  if (refresh) {
    refresh.addEventListener('click', async () => {
      await loadCustomGPTsFromUrl(CUSTOM_GPTS_URL);
    });
  }

  if (input) {
    input.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const raw = getCustomGPTRows(wb);
        customGPTs = raw.map(normalizeCustomGPTRow).filter(x => x.title);
        afterCustomGPTsLoaded();
      };
      reader.readAsArrayBuffer(f);
      // reset input so selecting the same file later still triggers change
      e.target.value = '';
    });
  }
}

/* -------------------------- Interactions / UX --------------------------- */

function initializeAccordion() {
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.accordion-header');
    if (header) {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');
      const accordion = item.parentElement;
      accordion.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    }
  });
}

function initializeTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const useCaseCards = document.querySelectorAll('.use-case-card');
      useCaseCards.forEach(card => {
        if (tab === 'all' || card.getAttribute('data-category') === tab) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function initializeFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const promptCards = document.querySelectorAll('#promptLibraryList .technique-card');
      promptCards.forEach(card => {
        const difficulty = card.getAttribute('data-difficulty');
        const category = card.getAttribute('data-category');
        if (filter === 'all' || difficulty === filter || category === filter) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function copyToClipboard(btn, text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

function initializeBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) btn.classList.add('visible');
    else btn.classList.remove('visible');
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ----------------------------- Stats Update ------------------------------ */

function updateStats() {
  const vals = document.querySelectorAll('.stats-grid .stat-value');
  if (vals.length >= 4) {
    const promptsCount = techniques.length + (useCases.length * 2);
    vals[0].innerText = theoryModules.length;          // Theory Modules
    vals[1].innerText = techniques.length;             // Techniques
    vals[2].innerText = useCases.length;               // Use Cases
    vals[3].innerText = promptsCount >= 50 ? (promptsCount + '+') : String(promptsCount);
  }
}

/* -------------------------- Boot / Lifecycle ----------------------------- */

function setupBaseUIWithoutData() {
  initializeNavigation();
  initializeBackToTop();
  initializeAccordion();
  initializeTabs();
  initializeFilters();
  initializeCustomGPTsUI(); // NEW
}

function afterDataLoaded() {
  buildSearchIndex();
  initializeSearch();

  renderTheorySection();
  renderTechniquesSection();
  renderUseCasesSection();
  renderBestPracticesSection();
  renderPromptLibrary();
  renderFAQSection();
  updateStats();
}

// NEW: after Custom GPTs loaded
function afterCustomGPTsLoaded() {
  renderGPTTags();
  applyGPTFilters(); // renders grid
  // update global search index to include GPTs
  buildSearchIndex();
}

document.addEventListener('DOMContentLoaded', async () => {
  setupBaseUIWithoutData();
  try {
    await ensureXLSX();
    try {
      // Load app content from docs/
      await loadExcelFromUrl(EXCEL_URL);
      afterDataLoaded();
    } catch {
      // If fetch is blocked (e.g., file://), let user upload the same Excel
      showUploadBanner();
    }

    // Load Custom GPTs (display-only). If this fails, users can upload manually.
    await loadCustomGPTsFromUrl(CUSTOM_GPTS_URL);
  } catch (e) {
    console.error(e);
    alert('Failed to load Excel parser. Please check your network.');
  }
});
