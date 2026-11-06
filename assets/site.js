// Dil seçimi: kayıtlı tercih > tarayıcı dili > İngilizce
(() => {
  const root = document.documentElement;
  let lang = 'en';
  try { lang = localStorage.getItem('mineup.lang') || ''; } catch (e) { lang = ''; }
  if (!lang) lang = (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  const apply = l => {
    root.dataset.lang = l; root.lang = l;
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.set === l)));
    const t = document.querySelector(`meta[name="title-${l}"]`); if (t) document.title = t.content;
    document.dispatchEvent(new Event('langchange'));
  };
  apply(lang);
  document.addEventListener('click', e => {
    const b = e.target.closest('.lang button'); if (!b) return;
    apply(b.dataset.set);
    try { localStorage.setItem('mineup.lang', b.dataset.set); } catch (err) {}
  });
})();
