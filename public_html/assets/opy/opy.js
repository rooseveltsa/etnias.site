(function () {
    'use strict';
    if (!document.body.classList.contains('opy-enabled') || window.etniasOpyReady) return;
    window.etniasOpyReady = true;
    var lastTrigger = new WeakMap();
    var sequence = 0;
    var submitted = false;

    function status(message) {
        var node = document.getElementById('opy-status');
        if (node) node.textContent = message;
    }
    var scrollY = 0;
    var backdropArmedAt = 0;
    function lockPage() {
        if (document.body.classList.contains('opy-scroll-lock')) return;
        scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        document.body.style.top = '-' + scrollY + 'px';
        document.body.classList.add('opy-scroll-lock');
    }
    function unlockPage() {
        if (!document.body.classList.contains('opy-scroll-lock')) return;
        document.body.classList.remove('opy-scroll-lock');
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
    }
    function openDialog(id, trigger) {
        var dialog = document.getElementById(id);
        if (!dialog || typeof dialog.showModal !== 'function') return;
        lastTrigger.set(dialog, trigger);
        lockPage();
        if (!dialog.open) dialog.showModal();
        backdropArmedAt = Date.now() + 450;
        document.body.classList.add('opy-dialog-open');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }
    document.querySelectorAll('.opy-dialog').forEach(function (dialog) {
        dialog.addEventListener('close', function () {
            if (!document.querySelector('.opy-dialog[open]')) {
                document.body.classList.remove('opy-dialog-open');
                unlockPage();
            }
            var trigger = lastTrigger.get(dialog);
            if (trigger && trigger.isConnected) {
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });
        dialog.addEventListener('click', function (event) {
            if (event.target !== dialog || Date.now() < backdropArmedAt) return;
            var bounds = dialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
        });
    });

    function dirty() {
        return Array.from(document.querySelectorAll('.publisher-box')).some(function (form) {
            return Array.from(form.querySelectorAll('textarea, input[type="text"]')).some(function (input) { return input.value.trim() !== ''; })
                || Array.from(form.querySelectorAll('input[type="file"]')).some(function (input) { return input.files && input.files.length > 0; })
                || Array.from(form.querySelectorAll('input[name="postRecord"], input[name="postSticker"], input[name="postMap"]')).some(function (input) { return input.value !== ''; });
        });
    }
    // Guard the new full-page links before the vendor's delegated AJAX handler.
    document.addEventListener('click', function (event) {
        var link = event.target.closest('a.opy-brand[href], .opy-sidebar a[href], .opy-bottom a[href], .opy-experiences a[href]');
        if (!link || link.hasAttribute('data-opy-compose') || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        var destination = new URL(link.href, location.href);
        if (destination.pathname === location.pathname && destination.search === location.search && destination.hash && !link.hasAttribute('data-opy-feed')) return;
        if (dirty()) {
            if (!window.confirm('Sua publicação ainda não foi enviada. Deseja sair e descartar o rascunho?')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            submitted = true;
        }
    }, true);
    document.addEventListener('submit', function (event) {
        if (!event.target.matches('.opy-search') || !dirty()) return;
        if (!window.confirm('Sua publicação ainda não foi enviada. Deseja pesquisar e descartar o rascunho?')) {
            event.preventDefault();
            return;
        }
        submitted = true;
    });
    window.addEventListener('beforeunload', function (event) {
        if (!submitted && dirty()) { event.preventDefault(); event.returnValue = ''; }
    });
    window.addEventListener('pageshow', function () {
        submitted = false;
        if (!document.querySelector('.opy-dialog[open]')) {
            document.body.classList.remove('opy-dialog-open', 'opy-keyboard-open');
            unlockPage();
        }
    });

    document.addEventListener('click', function (event) {
        var open = event.target.closest('[data-opy-open]');
        if (open) { event.preventDefault(); openDialog(open.getAttribute('data-opy-open'), open); return; }
        var close = event.target.closest('[data-opy-close]');
        if (close) { close.closest('dialog').close(); return; }
        var info = event.target.closest('[data-opy-info]');
        if (info) {
            document.getElementById('opy-info-title').textContent = info.getAttribute('data-opy-info');
            document.getElementById('opy-info-description').textContent = info.getAttribute('data-opy-description');
            document.querySelector('#opy-info .opy-info-state').textContent = info.getAttribute('data-opy-state') || 'Ainda não disponível';
            openDialog('opy-info', info);
            return;
        }
        var compose = event.target.closest('[data-opy-compose]');
        if (compose) {
            var textarea = document.querySelector('.publisher-box .postText');
            if (textarea) {
                event.preventDefault();
                if (typeof window.Wo_ShowPosInfo === 'function') window.Wo_ShowPosInfo();
                textarea.scrollIntoView({ behavior: 'auto', block: 'center' });
                textarea.focus({ preventScroll: true });
                status('Sua publicação está pronta para edição.');
            }
        }
        var more = event.target.closest('[data-opy-more]');
        if (more) {
            var options = document.getElementById(more.getAttribute('aria-controls'));
            if (options) {
                var expanded = more.getAttribute('aria-expanded') !== 'true';
                if (expanded) {
                    if (typeof window.Wo_ShowPosInfo === 'function') window.Wo_ShowPosInfo();
                    else {
                        var footer = more.closest('.publisher-box').querySelector('.publisher-box-footer');
                        if (footer) footer.style.display = 'block';
                    }
                    more.focus({ preventScroll: true });
                }
                more.setAttribute('aria-expanded', String(expanded));
                more.textContent = expanded ? 'Menos opções' : 'Mais opções';
                options.hidden = !expanded;
            }
        }
    });

    function enhancePublisher() {
        document.querySelectorAll('.publisher-box:not([data-opy-enhanced])').forEach(function (form) {
            var options = form.querySelector('.sun_pub_more');
            var textarea = form.querySelector('.postText');
            if (!options || !textarea) return;
            form.setAttribute('data-opy-enhanced', 'true');
            textarea.setAttribute('aria-label', 'Compartilhe com a comunidade');
            textarea.setAttribute('placeholder', 'Compartilhe uma história, uma ideia ou um saber…');
            options.id = 'opy-publisher-options-' + (++sequence);
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'opy-more';
            button.textContent = 'Mais opções';
            button.setAttribute('data-opy-more', '');
            button.setAttribute('aria-controls', options.id);
            button.setAttribute('aria-expanded', 'false');
            var original = form.querySelector('.mor');
            if (original) {
                // The original control is a span with a click handler on its parent.
                // Replace the whole wrapper to avoid calling Wo_ShowPosInfo on toggle.
                var wrapper = original.closest('.poster-left-buttons');
                (wrapper || original).replaceWith(button);
            } else options.before(button);
            options.hidden = true;
        });
    }
    function enhanceHeader() {
        [
            ['.opy-member-controls .notification-container > a', 'Maracá', 'Maracá — notificações'],
            ['.opy-member-controls .messages-notification-container > a', 'Chat', 'Chat — mensagens'],
            ['.opy-member-controls .requests-container > a', '', 'Solicitações de conexão']
        ].forEach(function (entry) {
            var anchor = document.querySelector(entry[0]);
            if (!anchor) return;
            anchor.setAttribute('aria-label', entry[2]);
            anchor.setAttribute('title', entry[2]);
            if (entry[1] && !anchor.querySelector('.opy-control-label')) {
                var span = document.createElement('span');
                span.className = 'opy-control-label';
                span.textContent = entry[1];
                anchor.appendChild(span);
            }
        });
        var account = document.querySelector('.opy-member-controls .user-menu-combination');
        if (account) account.setAttribute('aria-label', 'Abrir menu da conta');
    }
    function activeLinks() {
        var current = new URL(location.href);
        document.querySelectorAll('.opy-nav-item[href]').forEach(function (link) {
            var url = new URL(link.href, location.href);
            var route = current.searchParams.get('link1');
            var active = (url.pathname === current.pathname && url.search === current.search)
                || (link.hasAttribute('data-opy-feed') && (route === 'home'
                    || current.pathname === url.pathname.replace(/index\.php$/, '') && !route
                    || document.querySelector('.opy-sidebar [data-opy-destination="opy"][aria-current="page"]')));
            if (active && !link.hasAttribute('data-opy-compose')) link.setAttribute('aria-current', 'page');
        });
    }
    enhancePublisher();
    enhanceHeader();
    activeLinks();
    var content = document.getElementById('contnet');
    if (content) new MutationObserver(enhancePublisher).observe(content, { childList: true, subtree: true });
    if (location.hash === '#opy-compose') {
        var trigger = document.querySelector('[data-opy-compose]');
        if (trigger) trigger.click();
    }
    if (!window.__opyPressBound) {
    window.__opyPressBound = true;
    var pressedControl = null;
    var pressTimer = 0;
    function releasePress() {
        var control = pressedControl;
        pressedControl = null;
        if (!control) return;
        window.clearTimeout(pressTimer);
        pressTimer = window.setTimeout(function () { control.classList.remove('opy-pressed'); }, 220);
    }
    document.addEventListener('pointerdown', function (event) {
        if (event.target.closest('input, textarea, select')) return;
        var control = event.target.closest('a, button, label, summary, [role="button"]');
        if (!control || control.disabled) return;
        window.clearTimeout(pressTimer);
        if (pressedControl && pressedControl !== control) pressedControl.classList.remove('opy-pressed');
        pressedControl = control;
        control.classList.add('opy-pressed');
    }, { passive: true });
    document.addEventListener('pointerup', releasePress, { passive: true });
    document.addEventListener('pointercancel', releasePress, { passive: true });
    document.addEventListener('pointermove', function (event) {
        if (!pressedControl || !event.buttons) return;
        var under = document.elementFromPoint(event.clientX, event.clientY);
        if (!under || !pressedControl.contains(under)) releasePress();
    }, { passive: true });
    }

    function typingField(node) {
        if (!node || node === document.body || node === document.documentElement) return false;
        var tag = node.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (tag === 'INPUT') {
            var type = (node.type || 'text').toLowerCase();
            return ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'hidden', 'image'].indexOf(type) === -1;
        }
        return node.isContentEditable === true;
    }
    function viewportChange() {
        var viewport = window.visualViewport;
        var shrunk = !!(viewport && window.innerHeight - viewport.height > 160);
        document.body.classList.toggle('opy-keyboard-open', typingField(document.activeElement) && shrunk);
    }
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', viewportChange);
        window.visualViewport.addEventListener('scroll', viewportChange);
    }
    document.addEventListener('focusin', viewportChange);
    document.addEventListener('focusout', function () { window.setTimeout(viewportChange, 80); });

    var activeAudio = null;
    document.addEventListener('click', function (event) {
        var playBtn = event.target.closest('[data-music-play]');
        if (!playBtn) return;
        var labelSpan = playBtn.querySelector('span');
        if (activeAudio && activeAudio.button === playBtn) {
            activeAudio.stop();
            return;
        }
        if (activeAudio) activeAudio.stop();
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            status('Amostra sonora acionada.');
            return;
        }
        try {
            var ctx = new Ctx();
            var baseFreq = Number(playBtn.getAttribute('data-music-freq')) || 432;
            var notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.25];
            var now = ctx.currentTime;
            notes.forEach(function (freq, idx) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.35);
                gain.gain.setValueAtTime(0.001, now + idx * 0.35);
                gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.35 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.35 + 0.32);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.35);
                osc.stop(now + idx * 0.35 + 0.34);
            });
            playBtn.setAttribute('aria-pressed', 'true');
            if (labelSpan) labelSpan.textContent = 'Parar amostra';
            status('Reproduzindo amostra sonora do catálogo.');
            var timer = setTimeout(function () {
                if (activeAudio && activeAudio.button === playBtn) activeAudio.stop();
            }, 1500);
            activeAudio = {
                button: playBtn,
                stop: function () {
                    clearTimeout(timer);
                    playBtn.setAttribute('aria-pressed', 'false');
                    if (labelSpan) labelSpan.textContent = 'Ouvir amostra sonora';
                    try { ctx.close(); } catch (_) {}
                    activeAudio = null;
                }
            };
        } catch (_) {}
    });

    if (!document.body.classList.contains('opy-preview') && document.querySelector('[data-opy-module]')) {
        var storageKey = 'etnias_opy_modules_v1';
        var readLocal = function () {
            try {
                return JSON.parse(localStorage.getItem(storageKey) || '{}');
            } catch (_) {
                return {};
            }
        };
        var writeLocal = function (data) {
            try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (_) {}
        };
        var renderLocalModule = function () {
            var data = readLocal();
            var saberes = data.saberes || {};
            var music = data.music || {};
            var submissions = Array.isArray(data.submissions) ? data.submissions : [];
            var enrolledCount = 0;
            document.querySelectorAll('[data-saber-enroll]').forEach(function (btn) {
                var id = btn.getAttribute('data-saber-enroll');
                var on = !!saberes[id];
                if (on) enrolledCount++;
                btn.setAttribute('aria-pressed', String(on));
                btn.textContent = on ? 'Inscrito na trilha (avaliação)' : 'Inscrever-se na trilha';
                var meta = document.querySelector('[data-saber-count="' + id + '"]');
                if (meta) meta.textContent = on ? '1 inscrição nesta sessão' : 'Em avaliação';
            });
            var summary = document.getElementById('opy-saberes-summary');
            if (summary) {
                summary.textContent = enrolledCount > 0
                    ? 'Você acompanha ' + enrolledCount + ' trilha(s) formativa(s) nesta sessão de homologação.'
                    : 'Selecione abaixo as trilhas de seu interesse para acompanhar seu painel formativo nesta sessão.';
            }
            document.querySelectorAll('[data-music-like]').forEach(function (btn) {
                var id = btn.getAttribute('data-music-like');
                var on = !!music[id];
                btn.setAttribute('aria-pressed', String(on));
                var span = btn.querySelector('span');
                if (span) span.textContent = on ? 'Faixa apoiada' : 'Apoiar faixa';
                var meta = document.querySelector('[data-music-count="' + id + '"]');
                if (meta) meta.textContent = (on ? 1 : 0) + ' apoio(s) nesta sessão';
            });
            document.querySelectorAll('[data-opy-submissions]').forEach(function (container) {
                var mod = container.getAttribute('data-opy-submissions');
                var list = submissions.filter(function (s) { return s.module === mod; });
                container.replaceChildren();
                if (!list.length) {
                    var empty = document.createElement('p');
                    empty.className = 'opy-module-empty';
                    empty.textContent = 'Nenhum registro enviado ainda nesta sessão.';
                    container.appendChild(empty);
                    return;
                }
                list.forEach(function (item) {
                    var card = document.createElement('article');
                    card.className = 'opy-submission-card';
                    var head = document.createElement('div');
                    head.className = 'opy-submission-head';
                    var proto = document.createElement('span');
                    proto.className = 'opy-submission-protocol';
                    proto.textContent = 'Protocolo ' + item.protocol;
                    var cat = document.createElement('small');
                    cat.textContent = item.category + (item.audience === 'private' ? ' · Somente minha sessão' : '');
                    head.append(proto, cat);
                    var h3 = document.createElement('h3');
                    h3.textContent = item.title;
                    var p = document.createElement('p');
                    p.textContent = item.details;
                    var meta = document.createElement('div');
                    meta.className = 'opy-submission-meta';
                    var who = document.createElement('span');
                    who.textContent = item.community;
                    var del = document.createElement('button');
                    del.type = 'button';
                    del.className = 'opy-secondary-btn';
                    del.textContent = 'Remover registro';
                    del.addEventListener('click', function () {
                        var current = readLocal();
                        current.submissions = (current.submissions || []).filter(function (s) { return s.id !== item.id; });
                        writeLocal(current);
                        renderLocalModule();
                    });
                    meta.append(who, del);
                    card.append(head, h3, p, meta);
                    container.appendChild(card);
                });
            });
        };
        document.addEventListener('click', function (event) {
            var enroll = event.target.closest('[data-saber-enroll]');
            if (enroll) {
                var id = enroll.getAttribute('data-saber-enroll');
                var data = readLocal();
                data.saberes = data.saberes || {};
                data.saberes[id] = !data.saberes[id];
                writeLocal(data);
                renderLocalModule();
                return;
            }
            var like = event.target.closest('[data-music-like]');
            if (like) {
                var trackId = like.getAttribute('data-music-like');
                var d = readLocal();
                d.music = d.music || {};
                d.music[trackId] = !d.music[trackId];
                writeLocal(d);
                renderLocalModule();
            }
        });
        document.querySelectorAll('[data-opy-module-form]').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var mod = form.getAttribute('data-opy-module-form');
                var data = readLocal();
                data.submissions = Array.isArray(data.submissions) ? data.submissions : [];
                var protocol = 'OPY-' + mod.slice(0, 3).toUpperCase() + '-' + String(Date.now()).slice(-5);
                data.submissions.unshift({
                    id: String(Date.now()),
                    module: mod,
                    protocol: protocol,
                    category: form.elements.category ? form.elements.category.value : '',
                    community: form.elements.community ? form.elements.community.value.trim() : '',
                    title: form.elements.title ? form.elements.title.value.trim() : '',
                    details: form.elements.details ? form.elements.details.value.trim() : '',
                    audience: form.elements.audience ? form.elements.audience.value : 'public'
                });
                writeLocal(data);
                form.reset();
                var feedback = form.querySelector('[data-opy-module-status]');
                if (feedback) feedback.textContent = 'Registro salvo para avaliação · Protocolo ' + protocol;
                renderLocalModule();
            });
        });
        renderLocalModule();
    }
}());
// Menu da conta (details no cabeçalho): fecha ao clicar fora ou com Escape, como um menu de verdade.
(function () {
    function closeAll(except) { document.querySelectorAll('details.opy-account[open]').forEach(function (d) { if (d !== except) d.open = false; }); }
    document.addEventListener('click', function (event) { closeAll(event.target.closest('details.opy-account')); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeAll(null); });
}());
