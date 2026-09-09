/* АктиСтрой — интерактив. Без зависимостей. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── Шапка: тень + прогресс чтения ─────────────────────────────────── */
  // Высоту страницы читаем не на каждом кадре, а только когда она меняется:
  // чтение scrollHeight рядом с записью стиля заставляло браузер пересчитывать
  // раскладку по 60 раз в секунду и роняло скролл.
  var hdr = $('.hdr');
  var bar = $('.progressbar');
  var ticking = false;
  var scrollable = 0;
  var stuck = null;

  function measure() {
    scrollable = document.documentElement.scrollHeight - window.innerHeight;
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset;
      var isStuck = y > 8;
      if (hdr && isStuck !== stuck) { hdr.classList.toggle('is-stuck', isStuck); stuck = isStuck; }
      if (bar) bar.style.transform = 'scaleX(' + (scrollable > 0 ? Math.min(y / scrollable, 1) : 0) + ')';
      ticking = false;
    });
  }
  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  // Высота растёт по мере догрузки ленивых картинок — пересчитываем с задержкой,
  // чтобы наблюдатель сам не превратился в источник работы на каждый кадр.
  var reT;
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { clearTimeout(reT); reT = setTimeout(measure, 200); }).observe(document.body);
  }
  window.addEventListener('load', measure);
  onScroll();

  /* ── Мобильное меню ────────────────────────────────────────────────── */
  var burger = $('.burger');
  var menu = $('.menu');
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('is-open');
    if (burger) { burger.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
  }
  if (burger && menu) {
    $$('.menu__nav a').forEach(function (a, i) { a.style.animationDelay = (0.08 + i * 0.055) + 's'; });
    burger.addEventListener('click', function () {
      var open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('.menu a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeMenu();
    closeLightbox();
  });

  /* ── Бегущая строка: не крутим анимацию, когда её не видно ─────────── */
  var marquee = $('.marquee');
  if (marquee && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      marquee.classList.toggle('is-off', !es[0].isIntersecting);
    }).observe(marquee);
  }

  /* ── Появление при скролле ─────────────────────────────────────────── */
  var revealables = $$('.rv, .rvm');
  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
      // Запускаем раскрытие ДО входа в экран (200px запаса), иначе фото
      // догружается и декодируется уже во время анимации и появляется рывком.
    }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── Счётчики ──────────────────────────────────────────────────────── */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    // Год — не денежная сумма: «2 010» с разрядом читается как ошибка.
    var plain = el.hasAttribute('data-plain');
    var fmt = function (n) { return plain ? String(n) : n.toLocaleString('ru-RU'); };
    var dur = 1500, t0 = null;
    if (reduce) { el.textContent = fmt(target) + suffix; return; }
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var counters = $$('[data-count]');
  if (counters.length) {
    if (!('IntersectionObserver' in window)) { counters.forEach(animateCount); }
    else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          animateCount(en.target);
          cio.unobserve(en.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { cio.observe(el); });
    }
  }

  /* ── FAQ ───────────────────────────────────────────────────────────── */
  // Раскрытие через grid-template-rows: 0fr -> 1fr. Высоту не меряем и не
  // анимируем в пикселях — не нужен пересчёт на resize и нет дёрганья вёрстки.
  $$('.faq__i').forEach(function (item) {
    var q = $('.faq__q', item);
    if (!q) return;
    q.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      q.setAttribute('aria-expanded', String(open));
    });
  });

  /* ── Табы пакетов ──────────────────────────────────────────────────── */
  $$('[data-tabs]').forEach(function (root) {
    var tabs = $$('.tab', root), panes = $$('.pane', root);
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
        panes.forEach(function (p) { p.classList.remove('is-active'); });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        if (panes[i]) panes[i].classList.add('is-active');
      });
    });
  });

  /* ── Лайтбокс ──────────────────────────────────────────────────────── */
  var lb = $('.lb'), lbImg = $('.lb__img'), lbCount = $('.lb__count');
  var lbList = [], lbIdx = 0;
  function openLightbox(list, idx) {
    if (!lb) return;
    lbList = list; lbIdx = idx;
    paintLightbox();
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function paintLightbox() {
    if (!lbImg || !lbList.length) return;
    lbImg.src = lbList[lbIdx];
    lbImg.alt = 'Фотография объекта ' + (lbIdx + 1) + ' из ' + lbList.length;
    if (lbCount) lbCount.textContent = (lbIdx + 1) + ' / ' + lbList.length;
  }
  function closeLightbox() {
    if (!lb || !lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function stepLightbox(d) {
    if (!lbList.length) return;
    lbIdx = (lbIdx + d + lbList.length) % lbList.length;
    paintLightbox();
  }
  $$('[data-gal]').forEach(function (gal) {
    var srcs = $$('img', gal).map(function (i) { return i.getAttribute('data-full') || i.src; });
    $$('button', gal).forEach(function (b, i) {
      b.addEventListener('click', function () { openLightbox(srcs, i); });
    });
  });
  if (lb) {
    $('.lb__x').addEventListener('click', closeLightbox);
    $('.lb__nav--prev').addEventListener('click', function () { stepLightbox(-1); });
    $('.lb__nav--next').addEventListener('click', function () { stepLightbox(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'ArrowRight') stepLightbox(1);
      if (e.key === 'ArrowLeft') stepLightbox(-1);
    });
  }

  /* ── Видео с объектов ──────────────────────────────────────────────── */
  $$('.vid').forEach(function (box) {
    var v = $('video', box);
    if (!v) return;
    box.addEventListener('click', function () {
      if (v.paused) {
        $$('.vid video').forEach(function (o) { if (o !== v) { o.pause(); o.parentElement.classList.remove('is-playing'); } });
        v.play();
        box.classList.add('is-playing');
      } else {
        v.pause();
        box.classList.remove('is-playing');
      }
    });
    v.addEventListener('ended', function () { box.classList.remove('is-playing'); });
  });

  /* ── Маска телефона ────────────────────────────────────────────────── */
  function maskPhone(el) {
    function fmt() {
      var d = el.value.replace(/\D/g, '');
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 4) out += ') ' + d.slice(4, 7);
      if (d.length >= 7) out += '-' + d.slice(7, 9);
      if (d.length >= 9) out += '-' + d.slice(9, 11);
      el.value = out;
    }
    el.addEventListener('focus', function () { if (!el.value) el.value = '+7 ('; });
    el.addEventListener('input', fmt);
    el.addEventListener('blur', function () { if (el.value.replace(/\D/g, '').length < 11) { if (el.value === '+7 (') el.value = ''; } });
  }
  $$('input[type="tel"]').forEach(maskPhone);

  /* ── Отправка форм (тот же обработчик, что и на текущем сайте) ─────── */
  $$('form[data-bid]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = $('input[type="tel"]', form);
      if (phone && phone.value.replace(/\D/g, '').length < 11) {
        phone.focus();
        phone.style.borderBottomColor = 'var(--clay)';
        return;
      }
      var btn = $('button[type="submit"]', form);
      var label = btn ? btn.querySelector('.btn__label') : null;
      var prev = label ? label.textContent : '';
      if (label) label.textContent = 'Отправляем…';
      if (btn) btn.disabled = true;

      var data = new URLSearchParams(new FormData(form)).toString();
      fetch(form.getAttribute('action') || 'go-mail.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: data
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json().catch(function () { return { error: 0 }; });
      })
        .then(function (j) {
          if (j && Number(j.error) !== 0) throw new Error('mail');
          done(true);
        })
        .catch(function () { done(false); });

      // Контракт go-mail.php тот же, что на текущем сайте: POST form-urlencoded,
      // в ответе JSON {error: 0}. Ошибку не прячем — показываем телефон.
      function done(sent) {
        if (btn) btn.disabled = false;
        if (label) label.textContent = prev;
        var ok = form.querySelector('.form__ok');
        if (!ok) {
          ok = document.createElement('p');
          ok.className = 'form__ok form__note';
          form.appendChild(ok);
        }
        if (sent) {
          form.reset();
          ok.textContent = 'Заявка отправлена. Перезвоним в рабочее время — пн–пт, 9:00–18:00.';
          ok.style.color = 'var(--clay)';
        } else {
          ok.innerHTML = 'Не удалось отправить заявку. Позвоните нам: <a href="tel:+79197944242">+7 (919) 794-42-42</a>';
          ok.style.color = 'var(--clay)';
        }
      }
    });
  });

  /* ── Квиз ──────────────────────────────────────────────────────────── */
  var quiz = $('[data-quiz]');
  if (quiz) {
    var slides = $$('.quiz__slide', quiz);
    var total = slides.length;
    var idx = 0;
    var answers = {};
    var barI = $('.quiz__bar i', quiz);
    var stepLabel = $('.quiz__step', quiz);
    var next = $('.quiz__next', quiz);
    var prev = $('.quiz__prev', quiz);
    var msgField = $('input[name="message"]', quiz);

    function paint() {
      slides.forEach(function (s, i) { s.hidden = i !== idx; });
      if (barI) barI.style.transform = 'scaleX(' + ((idx + 1) / total) + ')';
      if (stepLabel) stepLabel.textContent = idx < total - 1 ? ('Шаг ' + (idx + 1) + ' из ' + (total - 1)) : 'Последний шаг';
      if (prev) prev.disabled = idx === 0;
      if (next) {
        next.hidden = idx === total - 1;
        var lbl = next.querySelector('.btn__label');
        if (lbl) lbl.textContent = idx === total - 2 ? 'Получить смету' : 'Следующий вопрос';
      }
    }
    function collect() {
      var parts = [];
      Object.keys(answers).forEach(function (k) { parts.push(k + ': ' + answers[k]); });
      if (msgField) msgField.value = parts.join('; ');
    }
    $$('.qopt', quiz).forEach(function (opt) {
      opt.addEventListener('click', function () {
        var slide = opt.closest('.quiz__slide');
        $$('.qopt', slide).forEach(function (o) { o.classList.remove('is-on'); });
        opt.classList.add('is-on');
        answers[slide.getAttribute('data-label')] = opt.textContent.trim();
        collect();
        setTimeout(function () { if (idx < total - 1) { idx++; paint(); } }, 260);
      });
    });
    $$('.qrange input', quiz).forEach(function (r) {
      var out = $('output', r.closest('.qrange'));
      var slide = r.closest('.quiz__slide');
      function upd() {
        if (out) out.firstChild.nodeValue = r.value + ' ';
        answers[slide.getAttribute('data-label')] = r.value + ' м²';
        collect();
      }
      r.addEventListener('input', upd);
      upd();
    });
    if (next) next.addEventListener('click', function () { if (idx < total - 1) { idx++; paint(); } });
    if (prev) prev.addEventListener('click', function () { if (idx > 0) { idx--; paint(); } });
    paint();
  }

  /* ── Магнитные кнопки ──────────────────────────────────────────────── */
  if (!reduce && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    // pointermove у игровых мышей приходит до 1000 раз в секунду. Без привязки
    // к кадру это 1000 записей стиля в секунду на ровном месте — считаем один
    // раз на кадр и геометрию кнопки меряем на входе, а не на каждом движении.
    $$('.btn').forEach(function (btn) {
      var rect = null, raf = 0, mx = 0, my = 0;
      btn.addEventListener('pointerenter', function () { rect = btn.getBoundingClientRect(); });
      btn.addEventListener('pointermove', function (e) {
        if (!rect) rect = btn.getBoundingClientRect();
        mx = e.clientX; my = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var x = (mx - rect.left - rect.width / 2) / rect.width;
          var y = (my - rect.top - rect.height / 2) / rect.height;
          btn.style.transform = 'translate3d(' + (x * 7).toFixed(2) + 'px,' + (y * 5).toFixed(2) + 'px,0)';
        });
      });
      btn.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        rect = null;
        btn.style.transform = '';
      });
    });
  }

  /* ── Год в подвале ─────────────────────────────────────────────────── */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
