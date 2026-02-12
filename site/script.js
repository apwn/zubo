/* ============================================
   Zubo Marketing Website — script.js
   Vanilla JS, zero dependencies
   ============================================ */

(function () {
  'use strict';

  /* ------------------------------------------
     1. Navigation — scroll state & mobile toggle
     ------------------------------------------ */
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  // Add scrolled class to nav on scroll
  function handleNavScroll() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  // Mobile toggle
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('open');
    });

    // Close mobile nav when a link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navLinks.classList.remove('open');
      });
    });
  }

  /* ------------------------------------------
     2. Scroll-triggered fade-in animations
     ------------------------------------------ */
  const fadeElements = document.querySelectorAll('.fade-in');

  const fadeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  fadeElements.forEach(function (el) {
    fadeObserver.observe(el);
  });

  /* ------------------------------------------
     3. Typed-text animation
     ------------------------------------------ */

  /**
   * Animates typing text into an element character by character.
   * @param {HTMLElement} el  — the span.typed-text element
   */
  function typeText(el) {
    if (el.dataset.started) return;
    el.dataset.started = 'true';

    const text = el.getAttribute('data-text') || '';
    const speed = parseInt(el.getAttribute('data-speed'), 10) || 50;
    const delay = parseInt(el.getAttribute('data-delay'), 10) || 0;

    // Create cursor
    const cursor = document.createElement('span');
    cursor.className = 'typed-cursor';
    el.textContent = '';
    el.appendChild(cursor);

    let index = 0;

    function typeChar() {
      if (index < text.length) {
        el.insertBefore(document.createTextNode(text[index]), cursor);
        index++;
        setTimeout(typeChar, speed + Math.random() * 20);
      } else {
        // Typing done — show next output if any
        showNextOutput(el);
        // Remove cursor after a brief pause
        setTimeout(function () {
          if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        }, 1500);
      }
    }

    setTimeout(typeChar, delay);
  }

  /**
   * After a typed-text finishes, reveal the sibling terminal-output
   * and trigger the next terminal-line if present.
   */
  function showNextOutput(typedEl) {
    const line = typedEl.closest('.terminal-line');
    if (!line) return;

    // Find next sibling that is an output
    let nextSibling = line.nextElementSibling;
    while (nextSibling) {
      if (nextSibling.classList.contains('terminal-output')) {
        nextSibling.style.opacity = '1';
        // Then look for the next terminal-line
        let afterOutput = nextSibling.nextElementSibling;
        if (afterOutput && afterOutput.classList.contains('terminal-line')) {
          setTimeout(function () {
            afterOutput.style.opacity = '1';
            const nextTyped = afterOutput.querySelector('.typed-text');
            if (nextTyped) typeText(nextTyped);
          }, 400);
        }
        break;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }

  /* ------------------------------------------
     4. Hero terminal — start immediately
     ------------------------------------------ */
  const heroTerminal = document.querySelector('.hero-terminal');
  if (heroTerminal) {
    const firstTyped = heroTerminal.querySelector('.typed-text');
    if (firstTyped) {
      // Small delay to let the page paint first
      setTimeout(function () {
        typeText(firstTyped);
      }, 600);
    }
  }

  /* ------------------------------------------
     5. Scroll-triggered terminal typing
        (for How It Works section)
     ------------------------------------------ */
  const scrollTypedElements = document.querySelectorAll('.typed-text[data-trigger="scroll"]');

  const typingObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          typeText(entry.target);
          typingObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.5,
    }
  );

  scrollTypedElements.forEach(function (el) {
    typingObserver.observe(el);
  });

  /* ------------------------------------------
     6. Stat counter animation
     ------------------------------------------ */
  const statValues = document.querySelectorAll('.oss-stat-value[data-count]');

  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const duration = 1800;
    const startTime = performance.now();

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const currentValue = Math.round(easedProgress * target);

      el.textContent = formatNumber(currentValue);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function formatNumber(num) {
    return num.toLocaleString('en-US');
  }

  const statObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.5,
    }
  );

  statValues.forEach(function (el) {
    statObserver.observe(el);
  });

  /* ------------------------------------------
     7. Smooth scroll for anchor links
        (fallback for browsers without CSS smooth)
     ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
          10
        ) || 64;
        const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ------------------------------------------
     8. Parallax-lite for hero gradient
     ------------------------------------------ */
  const heroGradient = document.querySelector('.hero-gradient');

  if (heroGradient) {
    let ticking = false;

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          requestAnimationFrame(function () {
            const scrolled = window.scrollY;
            if (scrolled < window.innerHeight) {
              heroGradient.style.transform =
                'translateX(-50%) translateY(' + scrolled * 0.15 + 'px)';
            }
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true }
    );
  }
})();
