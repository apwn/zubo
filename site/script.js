/* ============================================
   Zubo Marketing Website — script.js
   Vanilla JS, zero dependencies
   ============================================ */

/* OS toggle — must be global for inline onclick handlers */
function switchOS(os) {
  document.querySelectorAll('.os-btn').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('.os-content').forEach(function (c) { c.classList.remove('active'); });
  var btn = document.querySelector('.os-btn[data-os="' + os + '"]');
  if (btn) btn.classList.add('active');
  var content = document.querySelector('[data-os-content="' + os + '"]');
  if (content) content.classList.add('active');
}

(function () {
  'use strict';

  /* ------------------------------------------
     1. Navigation
     ------------------------------------------ */
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('nav-links');

  function handleScroll() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navLinks.classList.remove('open');
      });
    });
  }

  /* ------------------------------------------
     2. Scroll-triggered reveal animations
     ------------------------------------------ */
  var revealElements = document.querySelectorAll('.reveal');

  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  revealElements.forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ------------------------------------------
     3. Stat counter animation
     ------------------------------------------ */
  var statNumbers = document.querySelectorAll('.hero-stat-number');
  var statsAnimated = false;

  function animateCounters() {
    if (statsAnimated) return;
    statsAnimated = true;

    statNumbers.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      var duration = 1500;
      var start = 0;
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        // Ease out cubic
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.round(start + (target - start) * eased);
        el.textContent = current;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target;
        }
      }

      requestAnimationFrame(step);
    });
  }

  if (statNumbers.length > 0) {
    var statsSection = statNumbers[0].closest('.hero-stats');
    if (statsSection) {
      var statsObserver = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) {
            animateCounters();
            statsObserver.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      statsObserver.observe(statsSection);
    }
  }

  /* ------------------------------------------
     4. Terminal typing animation
     ------------------------------------------ */
  var terminalStarted = false;

  function typeText(element, callback) {
    var text = element.getAttribute('data-text');
    if (!text) { if (callback) callback(); return; }
    var i = 0;
    var speed = 25;

    function typeChar() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(typeChar, speed + Math.random() * 20);
      } else {
        if (callback) callback();
      }
    }

    typeChar();
  }

  function showElement(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  function runTerminalDemo() {
    if (terminalStarted) return;
    terminalStarted = true;

    var cursor = document.getElementById('terminal-cursor');

    // Step 1: Type first message
    setTimeout(function () {
      typeText(document.getElementById('typed-1'), function () {
        // Step 2: Show first response
        setTimeout(function () {
          showElement('response-1');
          // Step 3: Show and type second prompt
          setTimeout(function () {
            showElement('prompt-2');
            typeText(document.getElementById('typed-2'), function () {
              // Step 4: Show second response
              setTimeout(function () {
                showElement('response-2');
                // Step 5: Show and type third prompt
                setTimeout(function () {
                  showElement('prompt-3');
                  typeText(document.getElementById('typed-3'), function () {
                    // Step 6: Show third response
                    setTimeout(function () {
                      showElement('response-3');
                      if (cursor) cursor.style.display = 'none';
                    }, 600);
                  });
                }, 800);
              }, 800);
            });
          }, 800);
        }, 700);
      });
    }, 800);
  }

  var terminalBody = document.getElementById('terminal-body');
  if (terminalBody) {
    var termObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          runTerminalDemo();
          termObserver.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    termObserver.observe(terminalBody);
  }

  /* ------------------------------------------
     5. Copy-to-clipboard buttons
     ------------------------------------------ */
  function createCheckmarkIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '20 6 9 17 4 12');
    svg.appendChild(polyline);
    return svg;
  }

  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      if (!text) return;

      navigator.clipboard.writeText(text).then(function () {
        btn.classList.add('copied');
        // Save original children and replace with checkmark
        var originalChildren = Array.from(btn.childNodes).map(function (n) { return n.cloneNode(true); });
        while (btn.firstChild) btn.removeChild(btn.firstChild);
        btn.appendChild(createCheckmarkIcon());

        setTimeout(function () {
          btn.classList.remove('copied');
          while (btn.firstChild) btn.removeChild(btn.firstChild);
          originalChildren.forEach(function (child) { btn.appendChild(child); });
        }, 2000);
      });
    });
  });

  /* ------------------------------------------
     6. Quick Start tab switching (within macOS/Linux)
     ------------------------------------------ */
  document.querySelectorAll('.qs-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var parent = tab.closest('.os-content') || document;
      parent.querySelectorAll('.qs-tab').forEach(function (t) { t.classList.remove('active'); });
      parent.querySelectorAll('.qs-pane').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var paneId = 'qs-' + tab.getAttribute('data-tab');
      var pane = document.getElementById(paneId);
      if (pane) pane.classList.add('active');
    });
  });

  /* ------------------------------------------
     7. Bento card mouse glow effect
     ------------------------------------------ */
  document.querySelectorAll('.bento-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', x + 'px');
      card.style.setProperty('--mouse-y', y + 'px');
    });
  });

  /* ------------------------------------------
     8. Scroll progress bar
     ------------------------------------------ */
  var progressBar = document.getElementById('scroll-progress');
  if (progressBar) {
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var progress = h.scrollTop / (h.scrollHeight - h.clientHeight);
      progressBar.style.setProperty('--progress', Math.min(progress, 1));
    }, { passive: true });
  }

  /* ------------------------------------------
     9. Stagger reveal observer
     ------------------------------------------ */
  var staggerElements = document.querySelectorAll('.reveal-stagger');
  var staggerObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        staggerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  staggerElements.forEach(function (el) {
    staggerObserver.observe(el);
  });

  /* ------------------------------------------
     10. Card tilt effect
     ------------------------------------------ */
  document.querySelectorAll('.tilt-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;
      var tiltX = ((y - centerY) / centerY) * -4;
      var tiltY = ((x - centerX) / centerX) * 4;
      card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0)';
    });
  });

  /* ------------------------------------------
     11. Animated gradient border angle
     ------------------------------------------ */
  var glowBorders = document.querySelectorAll('.glow-border');
  if (glowBorders.length > 0 && !CSS.supports('animation-timeline', 'auto')) {
    var angle = 0;
    function updateAngle() {
      angle = (angle + 0.5) % 360;
      glowBorders.forEach(function (el) {
        el.style.setProperty('--angle', angle + 'deg');
      });
      requestAnimationFrame(updateAngle);
    }
    requestAnimationFrame(updateAngle);
  }

  /* ------------------------------------------
     12. Docs sidebar mobile toggle
     ------------------------------------------ */
  var docsSidebarToggle = document.getElementById('docs-sidebar-toggle');
  var docsSidebar = document.getElementById('docs-sidebar');
  if (docsSidebarToggle && docsSidebar) {
    docsSidebarToggle.addEventListener('click', function () {
      docsSidebar.classList.toggle('open');
      docsSidebarToggle.textContent = docsSidebar.classList.contains('open') ? '\u2715' : '\u2630';
    });
    // Close sidebar when clicking a link
    docsSidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        docsSidebar.classList.remove('open');
        docsSidebarToggle.textContent = '\u2630';
      });
    });
  }

  /* ------------------------------------------
     13. Smooth scroll for anchor links
     ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = anchor.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var offset = 80; // nav height + padding
        var top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

})();
