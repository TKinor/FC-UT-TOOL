// ==UserScript==
// @name         pandaSBC
// @namespace    http://tampermonkey.net/
// @version      2.0.5
// @description  基于FSU，enhancer插件的永动机滚卡助手,详细使用教程，891018121 群文件
// @license      MIT
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

/*
 * 脚本使用免责声明（Script Usage Disclaimer）
 *
 * 本脚本仅供个人学习和研究使用，不得用于任何商业或非法用途。
 * 作者对因使用本脚本造成的任何直接或间接损失、损害或法律责任不承担任何责任。
 * 使用者须自行评估风险并对其行为负责。请务必遵守目标网站的用户协议和相关法律法规。
 *
 * This script is provided “as is,” without warranty of any kind, express or implied.
 * The author shall not be liable for any damages arising out of the use of this script.
 * Use at your own risk and in compliance with the target site’s terms of service and applicable laws.
 */
(function () {
    'use strict';
    let highRatingPlayerThreshold = 98;//高分球员提示阈值
    const MAX_RATING_TOTW = 86; //周黑升级最大填充评分上限 猛猛干生效
    const MAX_RATING_NORMAL = 94;//普通SBC最大填充上限 猛猛干生效
    /*==================        1000ms=1s        ==================*/
    const SP_STABLE_FOR = 500; //色卡填充稳定时间（ms） ，如果填充色卡不稳定可以调大,建议500，100一加，自己尝试
    const SP_FILL_SUCCESS_TIME = 1500; //色卡填充是否成功检测时间（ms），如果填充色卡不稳定可以调大
    const ranges = [
        { range: [75, 81], type: 'all' },   // all = 俱乐部+仓库
        { range: [82, 86], type: 'all' },   // all = 俱乐部+仓库
        { range: [87, 88], type: 'all' },
        { range: [89, 96], type: 'all' },
        { type: 'storage' }                 // storage = 仅仓库
    ];
    const MIN_RATING_KEY = 'minRating';
    const DEFAULT_TIMEOUT = 15000;
    const version = '2.0.5';
    let page = unsafeWindow;
    let running = false;
    let minRating = Number(GM_getValue(MIN_RATING_KEY, 85)) || 85;
    let enableHandleDuplicate = GM_getValue('enableHandleDuplicate', false)
    let btnLoop, btnOpenPacks, btnDoSbc;
    let runningTask = '';
    let abortCtrl = null;
    let currentTaskDone = Promise.resolve();
    let isStopping = false;


    let FILTERED_SETS = [];
    let selectedLoopSetId = null;
    let selectedDoSbcSetId = null;

    const targetKeywords = [
        "83+",
        "FUTTIES",
        "阵容变异",
        "TOTW 升级",
        "FUTTIES 阵容",
        "10 名 85+ 升级",
        "10 名 84+ 升级"
    ];
    GM_addStyle(`
.panda-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:center;justify-content:center}.panda-modal{width:720px;max-width:calc(100vw - 40px);max-height:calc(100vh - 40px);background:#1f1f1f;border:1px solid #333;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);color:#eee;overflow:hidden;display:flex;flex-direction:column;font-family:inherit}.panda-modal__hd{padding:12px 16px;background:#252525;border-bottom:1px solid #333;display:flex;align-items:center;justify-content:space-between}.panda-modal__title{font-weight:700;font-size:15px}.panda-modal__close{border:none;background:transparent;color:#bbb;cursor:pointer;font-size:18px;line-height:1}.panda-modal__bd{padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;overflow:auto;flex:1;min-height:260px}.panda-col{background:#171717;border:1px solid #333;border-radius:10px;padding:10px;display:flex;flex-direction:column}.panda-col__title{font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;display:flex;align-items:center;gap:8px}.panda-col__tip{font-size:12px;color:#aaa}.panda-col__list{display:flex;flex-direction:column;gap:6px;overflow:auto}.panda-row{display:flex;gap:8px;align-items:center;color:#ddd;font-size:13px}.panda-row input[type="radio"]{accent-color:#ffc800;cursor:pointer}.panda-modal__ft{padding:10px 14px;border-top:1px solid #333;display:flex;gap:10px;justify-content:flex-end;background:#202020}.panda-btn{min-width:80px;height:32px;border-radius:8px;border:1px solid #555;cursor:pointer;font-weight:600;background:#2b2b2b;color:#ddd}.panda-btn--ok{background:#ffd76a;color:#222;border-color:#caa84b}.panda-btn:focus{outline:2px solid #666}.panda-col--highlight{box-shadow:0 0 0 2px #ffd76a55 inset}#sbc-panel{position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:110px;padding:16px 8px 10px 8px;font-family:inherit;background:rgba(30,30,30,0.96);border-radius:16px;box-shadow:0 4px 24px #0005}.sbc-input{width:70px;height:30px;font-size:18px;text-align:center;border-radius:8px;border:1px solid #ccc;margin-bottom:2px;background:#252525;color:#ffc800}.sbc-btn{width:90px;height:38px;border:none;outline:none;cursor:pointer;border-radius:10px;box-shadow:0 2px 8px #0002;font-weight:bold;transition:all .15s;user-select:none}.sbc-btn--open{background:#ffa600;color:#333}.sbc-btn--open:hover{background:#ffd700}.sbc-btn--loop{background:#ffe066;color:#333}.sbc-btn--loop:hover{background:#fffeb2}.sbc-btn--do{background:#ff6347;color:#fff}.sbc-btn--do:hover{background:#fd8578}.sbc-btn--assign{width:90px;height:38px;border-radius:8px;background:#5bc0de;color:#111;font-size:14px}.sbc-btn--assign:hover{background:#74d5f1}.sbc-chk{width:14px;height:14px;margin:2px 0 0 0;border-radius:3px;cursor:pointer;accent-color:#ffc800}.sbc-chklabel{color:#fff;font-size:13px;display:flex;align-items:flex-start;gap:6px;cursor:pointer;max-width:80px;line-height:1.3;word-break:break-word}#panda-dock{position:fixed;top:140px;right:0;z-index:99998;display:flex;align-items:stretch;transform:translateX(calc(100% - 28px));transition:transform .18s ease,opacity .12s ease}#panda-dock.left{left:0;right:auto;transform:translateX(calc(-100% + 28px))}#panda-dock.expanded.right{transform:translateX(0)}#panda-dock.expanded.left{transform:translateX(0)}#panda-dock.dragging{transition:none;opacity:.96}#panda-dock .dock-handle{width:38px;min-height:132px;background:#1e1e1e;border:1px solid #333;border-right:none;border-radius:12px 0 0 12px;box-shadow:0 4px 24px #0005;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;color:#ffc800;font-weight:700;writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:2px}#panda-dock.left .dock-handle{border-right:1px solid #333;border-left:none;border-radius:0 12px 12px 0}#panda-dock .dock-panel{background:rgba(30,30,30,.96);border:1px solid #333;border-radius:12px;box-shadow:0 4px 24px #0005;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:120px}#panda-dock #sbc-panel{all:unset;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:110px}#panda-dock .dock-foot{display:flex;gap:8px;justify-content:center;align-items:center;font-size:12px;color:#bbb;margin-top:6px}#panda-dock .dock-toggle{cursor:pointer;user-select:none;padding:4px 6px;border:1px solid #555;border-radius:8px;background:#2b2b2b}
.sbc-stats{display:flex;flex-direction:column;align-items:center;gap:6px;}.sbc-stat-card{width:90px;height:38px;background:#141414;border:1px solid #2a2a2a;border-radius:8px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px;}.sbc-stat-label{font-size:11px;color:#9aa;line-height:1;}.sbc-stat-value{font-weight:800;font-size:14px;color:#ffd76a;line-height:1;}
`);
    function makeAbortable(fn) {
        return function (...args) {
            const p = fn.apply(this, args);
            if (!abortCtrl) return p;
            const abortP = new Promise((_, rej) => {
                abortCtrl.signal.addEventListener('abort', () => rej(new Error('Aborted')), { once: true });
            });
            return Promise.race([p, abortP]);
        };
    }
    const _sleep = ms => new Promise(res => setTimeout(res, ms));
    const nextPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let _hiRatedPlayers = [];
    function simulateClick(el) {
        if (!el) {
            return new Error('no element');
        };
        const r = el.getBoundingClientRect();
        ['mousedown', 'mouseup', 'click'].forEach(t =>
            el.dispatchEvent(new MouseEvent(t, {
                bubbles: true, cancelable: true,
                clientX: r.left + r.width / 2,
                clientY: r.top + r.height / 2,
                button: 0
            }))
        );
    }
    function _waitForElement(fnOrSelector, timeout = DEFAULT_TIMEOUT, opts = {}) {
        let {
            root = document,
            subtree = true,
            returnAll = false,
            strict = false,
            stableFor = 16,
            preferLast = false,
            signal = abortCtrl?.signal,
        } = opts;

        root = typeof root === 'string' ? (document.querySelector(root) || document) : root;

        const isVisible = (el) => {
            if (!el || !el.isConnected) return false;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            const s = getComputedStyle(el);
            if (s.visibility === 'hidden' || s.display === 'none') return false;
            return true;
        };

        const isInteractable = (el) => {
            if (!isVisible(el)) return false;
            let n = el;
            while (n && n !== document) {
                const s = getComputedStyle(n);
                if (s.visibility === 'hidden' || s.display === 'none' || s.pointerEvents === 'none') return false;
                n = n.parentElement || n.ownerDocument?.host;
            }
            const r = el.getBoundingClientRect();
            const pts = [
                [r.left + r.width / 2, r.top + r.height / 2],
                [r.left + r.width * 0.8, r.top + r.height / 2],
                [r.left + r.width * 0.2, r.top + r.height / 2],
                [r.left + r.width / 2, r.top + r.height * 0.3],
                [r.left + r.width / 2, r.top + r.height * 0.7],
            ];
            for (const [x, y] of pts) {
                const top = document.elementFromPoint(x, y);
                if (top === el || el.contains(top)) return true;
            }
            return false;
        };

        const pass = strict ? isInteractable : isVisible;

        const getCandidates = () => {
            if (typeof fnOrSelector === 'string') {
                const list = root.querySelectorAll(fnOrSelector);
                if (!list || !list.length) return [];
                const arr = Array.from(list);
                return preferLast ? arr.reverse() : arr;
            } else if (typeof fnOrSelector === 'function') {
                const res = fnOrSelector();
                if (!res) return [];
                if (res instanceof Element) return [res];
                if (NodeList.prototype.isPrototypeOf(res) || Array.isArray(res)) {
                    const arr = Array.from(res);
                    return preferLast ? arr.reverse() : arr;
                }
                return [];
            }
            return [];
        };

        const watchStability = (el, onStable, onAbort) => {
            let stableTimer = null;

            const clearStableTimer = () => { if (stableTimer) { clearTimeout(stableTimer); stableTimer = null; } };

            const startStableTimerIfPass = () => {
                clearStableTimer();
                if (!el || !el.isConnected) return;
                if (!pass(el)) return;
                if (stableFor <= 32) {
                    (async () => {
                        await nextPaint();
                        if (el && el.isConnected && pass(el)) onStable(el);
                    })();
                    return;
                }
                stableTimer = setTimeout(() => onStable(el), stableFor);
            };

            const mutationObservers = [];
            let node = el;
            while (node && node !== document && node.nodeType === 1) {
                const mo = new MutationObserver(() => startStableTimerIfPass());
                mo.observe(node, {
                    attributes: true,
                    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
                    childList: true,
                    subtree: false,
                });
                mutationObservers.push(mo);
                node = node.parentElement || node.ownerDocument?.host;
            }

            const ro = new ResizeObserver(() => startStableTimerIfPass());
            try { ro.observe(el); } catch { }

            let io = null;
            try {
                io = new IntersectionObserver(() => startStableTimerIfPass(), { root: null, threshold: [0, 0.01, 0.5, 1] });
                io.observe(el);
            } catch { }

            const onTransEnd = () => startStableTimerIfPass();
            el.addEventListener('transitionend', onTransEnd, { passive: true });
            el.addEventListener('animationend', onTransEnd, { passive: true });

            startStableTimerIfPass();

            const unwatch = () => {
                clearStableTimer();
                mutationObservers.forEach(m => m.disconnect());
                try { ro.disconnect(); } catch { }
                try { io && io.disconnect(); } catch { }
                el.removeEventListener('transitionend', onTransEnd);
                el.removeEventListener('animationend', onTransEnd);
            };

            if (signal) {
                const abortFn = () => { unwatch(); onAbort && onAbort(); };
                if (signal.aborted) abortFn();
                else signal.addEventListener('abort', abortFn, { once: true });
            }

            return unwatch;
        };

        return new Promise((resolve) => {
            let settled = false;
            let timeoutId = null;
            let rootObserver = null;
            let unwatchEl = null;

            const resolveOnce = (val) => {
                if (settled) return;
                settled = true;
                try { rootObserver && rootObserver.disconnect(); } catch { }
                try { unwatchEl && unwatchEl(); } catch { }
                if (timeoutId) clearTimeout(timeoutId);
                resolve(val);
            };

            const tryPick = () => {
                if (settled) return;
                if (unwatchEl) { unwatchEl(); unwatchEl = null; }

                const list = getCandidates();
                if (returnAll) {
                    const okList = list.filter(pass);
                    if (okList.length) return resolveOnce(okList);
                } else {
                    const el = list.find(pass) || list[0];
                    if (el) {
                        unwatchEl = watchStability(
                            el,
                            (stableEl) => resolveOnce(stableEl),
                            () => resolveOnce(false)
                        );
                    }
                }
            };

            if (timeout > 0) timeoutId = setTimeout(() => resolveOnce(false), timeout);

            if (signal) {
                if (signal.aborted) return resolveOnce(false);
                signal.addEventListener('abort', () => resolveOnce(false), { once: true });
            }

            tryPick();

            rootObserver = new MutationObserver(() => {
                requestAnimationFrame(tryPick);
            });
            rootObserver.observe(root, { childList: true, subtree, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
        });
    }



    (function () {
        function hookRepositories() {
            try {
                if (!page.repositories || !repositories.Item) {
                    return false;
                }

                const domain = repositories.Item;
                if (domain._statsHooked) {
                    return true;
                }
                const safeUpdate = typeof updateStatsUI === 'function' ? updateStatsUI : (() => { });
                const debouncedUpdate = debounce(safeUpdate, 100);

                const storageRepo = domain.storage || {};
                const clubRepo = domain.club || {};

                function hookMethods(obj, methods) {
                    methods.forEach(name => {
                        if (!obj || typeof obj[name] !== 'function') return;
                        if (obj[name]._pandaHooked) return;

                        const orig = obj[name];
                        obj[name] = function (...args) {
                            const ret = orig.apply(this, args);
                            try { debouncedUpdate(); } catch (e) { }
                            return ret;
                        };
                        obj[name]._pandaHooked = true;
                    });
                }

                hookMethods(domain, ['add', 'remove', 'update', 'reset', 'set']);
                hookMethods(storageRepo, ['set', 'remove', 'reset', 'add', 'update']);
                hookMethods(clubRepo, ['add', 'remove', 'update', 'reset', 'set']);

                domain._statsHooked = true;
                safeUpdate();
                return true;

            } catch (e) {
                console.warn('[监控] 打桩异常：', e);
                return false;
            }
        }
        function hookXHR() {
            if (page._xhrHooked) return true;
            page._xhrHooked = true;
            page._xhrQueue = [];
            page._xhrPromiseList = [];

            const originOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (_method, url, ...args) {
                this._xhrFlag = { method: _method.toUpperCase(), url: String(url) };
                return originOpen.apply(this, [_method, url, ...args]);
            };

            const originSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (body) {
                this.addEventListener('load', function () {
                    for (const item of page._xhrPromiseList) {
                        if (
                            this._xhrFlag &&
                            this._xhrFlag.url.includes(item.apiPath) &&
                            (!item.method || this._xhrFlag.method === item.method.toUpperCase())
                        ) {
                            if (this.status === 401) {
                                item.status401Count = (item.status401Count || 0) + 1;
                                if (item.status401Count >= 2 && !item.resolved) {
                                    item.resolved = true;
                                    clearTimeout(item._timer);
                                    item.resolve(null);
                                }
                                continue;
                            }
                            if (!item.resolved) {
                                item.resolved = true;
                                clearTimeout(item._timer);
                                try {
                                    item.resolve(JSON.parse(this.responseText));
                                } catch {
                                    item.resolve(null);
                                }
                            }
                        }
                    }
                    page._xhrPromiseList = page._xhrPromiseList.filter(item => !item.resolved);
                });
                return originSend.apply(this, arguments);
            };
            console.log('[hookXHR] Hooked');
            return true;
        }

        function hookEventsPopup() {
            const events = page.events;
            if (
                !events ||
                typeof events.popup !== 'function' ||
                events.popup._isPatched
            ) return !!(events && typeof events.popup === 'function' && events.popup._isPatched);

            const interceptMap = {
                '珍贵球员': 44408,
                '快速任务': 2
            };
            const _orig = events.popup;
            events.popup = function (
                title, message, callback, buttonOptions,
                inputPlaceholder, inputValue, inputEnabled, extraNode
            ) {
                if (typeof title === 'string') {
                    for (let key in interceptMap) {
                        if (title.includes(key)) {
                            const code = interceptMap[key];
                            return callback(code);
                        }
                    }
                }
                return _orig.call(this,
                    title, message, callback, buttonOptions,
                    inputPlaceholder, inputValue, inputEnabled, extraNode
                );
            };
            events.popup._isPatched = true;
            console.log('[hookEventsPopup] Hooked');
            return true;
        }

        function hookLoading() {
            if (EAClickShieldView._hookedForLoadingEnd) return true;
            const oldHideShield = EAClickShieldView.prototype.hideShield;
            EAClickShieldView.prototype.hideShield = function (e) {
                oldHideShield.apply(this, arguments);
                if (!this.isShowing()) {
                    if (Array.isArray(EAClickShieldView._onLoadingEndQueue)) {
                        for (const fn of EAClickShieldView._onLoadingEndQueue) {
                            try { fn(); } catch (e) { }
                        }
                        EAClickShieldView._onLoadingEndQueue = [];
                    }
                }
            };
            EAClickShieldView._onLoadingEndQueue = [];
            EAClickShieldView._hookedForLoadingEnd = true;
            console.log('[hookLoading] Hooked');
            return true;
        }

        function doAllHooks() {
            let ok1 = hookXHR();
            let ok2 = hookEventsPopup();
            let ok3 = hookLoading();
            let ok4 = hookRepositories();
            if (ok1 && ok2 && ok3 && ok4 && page._eaHookTimer) {
                clearInterval(page._eaHookTimer);
                page._eaHookTimer = null;
                console.log('[doAllHooks] All hooks success, timer stopped.');
            }
        }

        doAllHooks();

        page._eaHookTimer = setInterval(doAllHooks, 1500);

    })();
    function _waitForRequest(apiPath, method, timeout = 15000, opts = {}) {
        const { signal = abortCtrl?.signal } = opts;
        return new Promise((resolve, reject) => {
            const item = {
                apiPath,
                method,
                resolve: (v) => { cleanup(); resolve(v); },
                status401Count: 0,
                resolved: false,
                _timer: null,
            };

            const cleanup = () => {
                if (item.resolved) return;
                item.resolved = true;
                if (item._timer) clearTimeout(item._timer);
                page._xhrPromiseList = (page._xhrPromiseList || []).filter(x => x !== item);
            };

            item._timer = setTimeout(() => {
                if (!item.resolved) item.resolve(null);
            }, timeout);

            if (!Array.isArray(page._xhrPromiseList)) page._xhrPromiseList = [];
            page._xhrPromiseList.push(item);

            if (signal) {
                if (signal.aborted) { cleanup(); return reject(new Error('Aborted')); }
                signal.addEventListener('abort', () => { cleanup(); reject(new Error('Aborted')); }, { once: true });
            }
        });
    }


    function _waitEALoadingEnd() {
        return new Promise(res => {
            const shield = typeof gClickShield === 'object' ? gClickShield : null;
            if (shield && !shield.isShowing()) return res();
            EAClickShieldView._onLoadingEndQueue.push(res);
        });
    }
    async function _waitAllEALoadingEnd(stableDelay = 600, timeout = 10000) {
        const shield = typeof gClickShield === 'object' ? gClickShield : null;
        const start = Date.now();

        while (true) {
            if (shield && shield.isShowing()) {
                await sleep(300);
            } else {
                let stable = true;
                const t0 = Date.now();
                while (Date.now() - t0 < stableDelay) {
                    if (shield && shield.isShowing()) {
                        stable = false;
                        break;
                    }
                    await sleep(100);
                }
                if (stable) return true;
            }
            if (Date.now() - start > timeout) {
                console.warn("[_waitAllEALoadingEnd] 等待超时");
                return false;
            }
        }
    }
    function _waitForController(name, timeout = DEFAULT_TIMEOUT, opts = {}) {
        const { pollInterval = 800, signal = abortCtrl?.signal } = opts;

        return new Promise((resolve, reject) => {
            const start = Date.now();
            let timer = null;
            const cleanup = () => { if (timer) clearTimeout(timer); };

            const tick = () => {
                if (signal?.aborted) { cleanup(); return reject(new Error('Aborted')); }
                try {
                    const ctrl = getAppMain()
                        .getRootViewController()
                        .getPresentedViewController()
                        .getCurrentViewController()
                        .getCurrentController();
                    if (ctrl?.constructor?.name === name) { cleanup(); return resolve(ctrl); }
                } catch { }

                if (Date.now() - start > timeout) { cleanup(); return reject(new Error(`等待${name}超时`)); }
                timer = setTimeout(tick, pollInterval);
            };

            if (signal) {
                if (signal.aborted) return reject(new Error('Aborted'));
                signal.addEventListener('abort', () => { cleanup(); reject(new Error('Aborted')); }, { once: true });
            }

            tick();
        });
    }


    function findEllipsisBtnOfUntradeableDupSection() {
        const root = document.querySelector('.sectioned-item-list:last-of-type');
        if (!root) return null;
        const container = root.querySelector('.ut-section-header-view') || root;
        return container.querySelector('.ut-section-header-view .ut-image-button-control.ellipsis-btn') ||
            container.querySelector('.ut-image-button-control.ellipsis-btn') ||
            null;
    }

    function _waitAndClickQuickSellUntradeableBtn(timeout = 8000) {
        return new Promise(async resolve => {
            const modal = await waitForElement('.view-modal-container.form-modal .ut-bulk-action-popup-view', timeout).catch(() => null);
            if (!modal) return resolve();
            const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.includes('快速出售'));
            if (btn) simulateClick(btn);
            await waitEALoadingEnd();
            resolve();
        });
    }
    const DEFAULT_WAIT_TIMEOUT = 10000;
    function _waitForLoadingStart(timeout = DEFAULT_WAIT_TIMEOUT) {
        return waitForElement(
            '.ut-click-shield.showing.fsu-loading',
            timeout
        );
    }

    function waitForLoadingEnd(timeout = DEFAULT_WAIT_TIMEOUT, opts = {}) {
        const { interval = 200, signal = abortCtrl?.signal } = opts;
        return new Promise((resolve, reject) => {
            const start = Date.now();
            let timer = null;
            const step = () => {
                if (signal?.aborted) { if (timer) clearTimeout(timer); return resolve(false); }
                const el = document.querySelector('.ut-click-shield.showing.fsu-loading');
                if (!el) return resolve(true);
                if (Date.now() - start > timeout) return resolve(false);
                timer = setTimeout(step, interval);
            };
            if (signal) {
                if (signal.aborted) return resolve(false);
                signal.addEventListener('abort', () => { if (timer) clearTimeout(timer); resolve(false); }, { once: true });

            }
            step();
        });
    }
    async function _waitFSULoading(timeout = DEFAULT_WAIT_TIMEOUT, opts = {}) {
        const started = await waitForLoadingStart(2000).catch(() => false);
        if (!started) return;
        await waitForLoadingEnd(timeout, opts);
    }
    async function _clickIfExists(selector, timeout = 2000, clickDelay = 500, opt = {}, ignoreError = false) {
        const el = await waitForElement(selector, timeout, opt);
        if (!el) {
            if (ignoreError) return false;
            throw new Error(`clickIfExists: 元素 "${selector}" ${timeout}ms 内未找到`);
        }
        try {
            if (clickDelay > 0) {
                await nextPaint();
            }
            simulateClick(el);
            return el;
        } catch (e) {
            if (ignoreError) return false;
            throw e;
        }
    }
    function _waitForElementGone(selector, timeout = DEFAULT_TIMEOUT, opts = {}) {
        const { interval = 200, signal = abortCtrl?.signal } = opts;
        return new Promise((resolve, reject) => {
            const start = Date.now();
            let timer = null;
            const stop = () => { if (timer) clearTimeout(timer); };

            const step = () => {
                if (signal?.aborted) { stop(); return reject(new Error('Aborted')); }
                if (!document.querySelector(selector)) { stop(); return resolve(true); }
                if (Date.now() - start > timeout) { stop(); return resolve(false); }
                timer = setTimeout(step, interval);
            };

            if (signal) {
                if (signal.aborted) return reject(new Error('Aborted'));
                signal.addEventListener('abort', () => { stop(); reject(new Error('Aborted')); }, { once: true });
            }

            step();
        });
    }
    async function _findBtnByText(selector, text, timeout = DEFAULT_WAIT_TIMEOUT) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const btn = Array.from(document.querySelectorAll(selector))
                .find(el => el.innerText.trim().includes(text));
            if (btn) return btn;
            await sleep(200);
        }
        console.warn(`未找到按钮：selector="${selector}"，text="${text}"`);
        return null;
    }

    async function _addPlayer() {
        const checkSel = '.ut-image-button-control.filter-btn.custom-player-add';
        const searchSel = '.ut-image-button-control.fsu-eligibilitysearch';
        const addSel = '.ut-image-button-control.btnAction.add';
        const canvasSel = '.ut-squad-pitch-view--canvas';
        const maxTries = 3;

        function _getController() {
            try {
                return getAppMain()
                    .getRootViewController()
                    .getPresentedViewController()
                    .getCurrentViewController()
                    .getCurrentController();
            } catch { return null; }
        }
        function _getSquad() {
            const c = _getController();
            return c && c._squad ? c._squad : null;
        }
        function _getSlots() {
            const sq = _getSquad();
            return sq ? (sq.getPlayers?.() || sq._players || []) : [];
        }
        function getFilledCount() {
            return _getSlots().filter(s => s && s._item && Number(s._item.definitionId) > 0).length;
        }
        async function waitCountStable({ baseCount, stableFor = 1000, timeout = 6000, poll = 150 }) {
            const start = Date.now();
            let last = getFilledCount();
            let lastAt = Date.now();
            while (Date.now() - start <= timeout) {
                await sleep(poll);
                const cur = getFilledCount();
                if (cur !== last) { last = cur; lastAt = Date.now(); }
                if (last >= baseCount + 1 && (Date.now() - lastAt) >= stableFor) {
                    return true;
                }
            }
            return false;
        }

        await waitForElement(() =>
            Array.from(document.querySelectorAll('button.btn-standard.mini.call-to-action'))
                .find(b => b.textContent.trim() === '重复球员填充阵容'),
            5000, { root: '.ut-navigation-container-view--content', strict: true }
        );
        if (!await waitForElement(checkSel, 5000)) return;

        for (let attempt = 1; attempt <= maxTries; attempt++) {
            const baseCount = getFilledCount();

            const ok1 = await clickIfExists(searchSel, 5000, 500, {
                root: '.ut-navigation-container-view--content',
                strict: false,
                stableFor: SP_STABLE_FOR
            }, true);
            if (!ok1) {
                console.log('search 按钮未点到，重试');
                await clickIfExists(canvasSel, 800, 300, { strict: false }, true);
                continue;
            }
            await waitForLoadingEnd();


            const ok2 = await clickIfExists(addSel, 10000, 500, {
                root: '.ut-navigation-container-view--content',
                strict: false,
                stableFor: SP_STABLE_FOR
            }, true);
            if (!ok2) {
                console.log('add 按钮未点到，重试');
                await clickIfExists(canvasSel, 800, 300, { strict: false }, true);
                continue;
            }
            await waitForLoadingEnd();
            await clickIfExists(canvasSel, 200, 200, { strict: false }, true);

            const ok = await waitCountStable({ baseCount, stableFor: SP_FILL_SUCCESS_TIME, timeout: 6000, poll: 150 });
            if (ok) return;

            if (attempt < maxTries) {
                console.log('色卡未添加，重新添加');
                await clickIfExists(canvasSel, 800, 300, { strict: false }, true);
            } else {
                throw new Error('色卡添加失败）');
            }
        }
    }
    function _collectHiRated(items, highRatingPlayerThreshold = 98) {
        const hiRated = items.filter(p =>
            p.type === 'player' && p.loans === -1 && p.rating >= highRatingPlayerThreshold
        );

        _hiRatedPlayers.push(...hiRated);
    }
    function _showHiRatedPopup(title = `本次高分球员（≥98）`) {
        if (!_hiRatedPlayers.length) return;

        const popupController = new EADialogViewController({
            dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
            message: "",
            title,
            type: EADialogView.Type.MESSAGE
        });
        popupController.init();

        popupController.onExit.observe(popupController, (e) => {
            e.unobserve(popupController);
            _hiRatedPlayers = [];
            try {
                if (cntlr.current() instanceof UTStorePackViewController) {
                    cntlr.current().getStorePacks(true);
                }
            } catch (_) { }
        });

        const popupView = popupController.getView();
        const rootEl = popupView.getRootElement();
        const bodyEl =
            rootEl.querySelector(".ea-dialog-view--body") ||
            rootEl.querySelector(".ea-dialog-view ") ||
            rootEl;

        if (popupView.__msg) {
            popupView.__msg.remove();
        }
        popupView.getRootElement().style.width = "40rem";
        popupView.getRootElement().style.maxWidth = "none";
        const box = document.createElement("div");
        box.style.cssText = "padding:0 1rem 1.5rem 1rem;";

        const players = _hiRatedPlayers
            .slice()
            .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
            .slice(0, 20);

        if (players.length) {
            const listBox = document.createElement("div");
            listBox.className = "ut-store-reveal-modal-list-view";
            listBox.style.borderRadius = "0";

            const ul = document.createElement("ul");
            ul.className = "itemList";
            listBox.appendChild(ul);

            popupController.listRows = players.map((i) => {
                const row = new UTItemTableCellView();
                row.setData(i, void 0, (typeof ListItemPriority !== "undefined" ? ListItemPriority.DEFAULT : void 0));
                row.render();
                ul.appendChild(row.getRootElement());
                return row;
            });

            box.appendChild(listBox);
        }

        const maxRating = players.reduce((m, p) => Math.max(m, Number(p.rating || 0)), 0);
        const summary = document.createElement("div");
        summary.textContent = `本次共 ${_hiRatedPlayers.length} 名 ≥${highRatingPlayerThreshold} 分，最高 ${maxRating}。`;
        summary.style.cssText = "padding-top:.5rem;font-size:1rem;";
        box.appendChild(summary);

        bodyEl.prepend(box);

        if (typeof gPopupClickShield !== "undefined" && gPopupClickShield?.setActivePopup) {
            gPopupClickShield.setActivePopup(popupController);
        }
    }

    async function _forceLoop() {
        console.log('[forceLoop] start');
        try {
            await waitForController('UTStorePackViewController', 20000);
            const ok = await setPackFilter();
            if (!ok) return false;
            await clickIfExists(() => {
                const btns = document.querySelectorAll('button.currency.call-to-action');
                return Array.from(btns).reverse().find(b => {
                    const txt = b.querySelector('span.text')?.textContent.trim();
                    return txt === '打开' &&
                        b.closest('.ut-store-pack-details-view')?.style.display !== 'none';
                });
            }, 30000, 500);
            await waitForController('UTUnassignedItemsSplitViewController', 20000);
            if (enableHandleDuplicate) {
                await handleUnassignedDuplicate(minRating);
            }
            await goToSBC({ setId: Number(selectedLoopSetId) });

            const rptBtn = await waitForElement(() =>
                Array.from(document.querySelectorAll('button.btn-standard.mini.call-to-action'))
                    .find(b => b.textContent.trim() === '重复球员填充阵容'),
                5000, { strict: true }
            );
            if (rptBtn) {
                simulateClick(rptBtn);
                await waitFSULoading();
            }

            await addPlayer();

            await clickIfExists(() =>
                Array.from(document.querySelectorAll('button.btn-standard.mini.call-to-action'))
                    .find(b => b.textContent.includes('阵容补全')),
                5000, 500, { strict: true });

            await clickIfExists(() =>
                Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === '确定'),
                5000, 500);
            await waitFSULoading();
            let hasSwapPlayer = false;
            waitForRequest('/item?idList=', 'GET', 15000)
                .then(data => {
                    if (data) {
                        hasSwapPlayer = true;
                    }
                });
            const req = waitForRequest('?skipUserSquadValidation=', 'PUT');


            await clickIfExists('button.ut-squad-tab-button-control.actionTab.right.call-to-action:not(.disabled)', 5000, 500, { strict: true });
            const data = await req;
            if (!data?.grantedSetAwards?.length) return;

            await waitEALoadingEnd();
            const ctrl = await waitForController('UTUnassignedItemsSplitViewController', 12000, { signal: undefined })
                .catch(e => /Aborted|超时/.test(String(e?.message)) ? null : Promise.reject(e));
            if (ctrl) {
                if (hasSwapPlayer) {
                    console.log('[forceLoop] swap player');
                    await sleep(3000);
                }
                await handleUnassigned(minRating);
            }

            await waitForController('UTStorePackViewController');
            await waitAllEALoadingEnd();

            console.log('[forceLoop] done');
        } catch (error) {
            console.error(error);
            stopLoop();
        }
    }

    function hasHighRating(resp, threshold = 91) {
        const players = resp?.squad?.players || [];
        console.log(players);
        return players
            .map(p => p?.itemData || p)
            .filter(it => it && it.rating >= threshold);
    }
    async function _doSBC() {
        await goToSBC({ setId: Number(selectedDoSbcSetId) });
        let sbcSet = services.SBC.repository.getSetById(selectedDoSbcSetId);
        let sbcTitle = sbcSet.name || '';
        let isTOTW = sbcTitle.includes('TOTW');
        await Promise.all([
            waitForController('UTSBCSquadSplitViewController', 20000),
            waitEALoadingEnd()
        ]);
        async function doFill() {
            if (!isTOTW) await addPlayer();
            await clickIfExists(
                () => Array.from(document.querySelectorAll('button.btn-standard.mini.call-to-action'))
                    .find(b => b.textContent.includes('阵容补全')),
                10000, 500
            );
            await clickIfExists(
                () => Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === '确定'),
                10000, 500
            );

        }

        async function tryFastFill() {
            const fastBtn = await findBtnByText(
                'button.btn-standard.mini.call-to-action',
                '一键填充',
                2000
            );
            if (fastBtn) {
                simulateClick(fastBtn);
                return true;
            }
            return false;
        }
        const squadPromise = waitForRequest('/squad', 'GET')
        if (isTOTW) {
            await doFill();
        } else if (!(await tryFastFill())) {
            await doFill();
        }
        await waitFSULoading();

        let squad = await squadPromise;
        if (hasHighRating(squad, isTOTW ? MAX_RATING_TOTW : MAX_RATING_NORMAL).length > 0) return false;

        const req = waitForRequest('?skipUserSquadValidation=', 'PUT');

        await clickIfExists('button.ut-squad-tab-button-control.actionTab.right.call-to-action:not(.disabled)', 5000, 500);
        const data = await req;
        if (!data?.grantedSetAwards?.length) return;

        await waitAllEALoadingEnd();
        console.log('[doSBC] done');
        return true
    }
    async function _openPacks() {
        console.log('[forceLoop] openPacks');
        try {
            await waitForController('UTStorePackViewController', 20000);
            await clickIfExists(() => {
                const btns = document.querySelectorAll('button.currency.call-to-action');
                return Array.from(btns).reverse().find(b => {
                    const txt = b.querySelector('span.text')?.textContent.trim();
                    return txt === '打开' &&
                        b.closest('.ut-store-pack-details-view')?.style.display !== 'none';
                });
            }, 20000, 500);


            await waitForController('UTUnassignedItemsSplitViewController', 20000);

            await handleUnassigned(minRating);

            await waitForController('UTStorePackViewController');
            await waitAllEALoadingEnd();

            console.log('[forceLoop] openPacks done');
            return true
        } catch (error) {
            console.error(error);
            stopLoop();

            return false
        }
    }
    function _moveItems(items, pile, controller) {
        return new Promise((resolve, reject) => {
            if (!items || !items.length) return resolve({ success: true });
            services.Item.move(items, pile, true).observe(controller, (e, t) => {
                e.unobserve(controller);
                if (!t.success) {
                    alert("移动失败");
                    reject(new Error("移动失败"));
                    return;
                }
                resolve(t);
            });
        });
    }

    function getUnassignedController() {
        const ctl = getAppMain()
            .getRootViewController()
            .getPresentedViewController()
            .getCurrentViewController()
            .getCurrentController();
        if (!ctl || !ctl.childViewControllers) return null;

        return Array.from(ctl.childViewControllers).find(c =>
            c.className &&
            c.className.includes('UTUnassigned') &&
            c.className.includes('Controller')
        );
    }
    async function _handleUnassignedDuplicate(minRating) {
        let controller = await getUnassignedController();
        let times = 0;
        let items = [];
        while (items.length === 0 && times < 3) {
            items = repositories.Item.getUnassignedItems();
            times++;
            await sleep(1500)
        }
        if (items.length === 0) return
        const toStorage = items.filter(p => p.type === 'player' && p.loans === -1 && p.untradeable && p.isDuplicate() && p.rating >= minRating);
        const spaceLeft = 100 - repositories.Item.numItemsInCache(ItemPile.STORAGE);
        if (toStorage.length > spaceLeft) {
            alert(`仓库已满`);
            throw new Error('仓库已满');
        }
        await moveItems(toStorage, ItemPile.STORAGE, controller);
    }
    async function _handleUnassigned(minRating) {
        let controller = await getUnassignedController();
        let times = 0;
        let items = [];
        while (items.length === 0 && times < 3) {
            items = repositories.Item.getUnassignedItems();
            times++;
            await sleep(1500)
        }
        if (items.length === 0) return
        _collectHiRated(items, highRatingPlayerThreshold);
        const itemsLength = items.length;
        const tradablePlayers = items.filter(p => p.type === 'player' && p.loans === -1 && !p.untradeable);
        const toStorage = items.filter(p => p.type === 'player' && p.loans === -1 && p.untradeable && p.isDuplicate() && p.rating >= minRating);
        const clubPlayers = items.filter(p => p.type === 'player' && p.loans === -1 && p.untradeable && !p.isDuplicate());
        console.log('[handleUnassigned] tradablePlayers', tradablePlayers.length, 'clubPlayers', clubPlayers.length, 'toStorage', toStorage.length);
        if (tradablePlayers.length) {
            await moveItems(tradablePlayers, ItemPile.TRANSFER, controller);
        }
        if (clubPlayers.length) {
            await moveItems(clubPlayers, ItemPile.CLUB, controller);
        }
        const spaceLeft = 100 - repositories.Item.numItemsInCache(ItemPile.STORAGE);

        if (toStorage.length > spaceLeft) {
            alert(`仓库已满`);
            throw new Error('仓库已满');
        }
        if (toStorage.length) {
            await moveItems(toStorage, ItemPile.STORAGE, controller);
        }

        await refreshUnassignedItems(controller);
        await waitEALoadingEnd();
        await sleep(1000);

        console.log('[handleUnassigned] itemsLength', itemsLength, 'tradablePlayers', tradablePlayers.length, 'clubPlayers', clubPlayers.length, 'toStorage', toStorage.length);
        if (itemsLength == tradablePlayers.length + clubPlayers.length + toStorage.length) return
        const ellipsisBtn = await waitForElement(
            findEllipsisBtnOfUntradeableDupSection,
            2000
        );
        if (ellipsisBtn) {
            simulateClick(ellipsisBtn);
            await waitAndClickQuickSellUntradeableBtn();
            await waitEALoadingEnd();
        }

        return true
    }
    function getCurrentStoreView() {
        try {
            const vc = getAppMain()
                .getRootViewController()
                .getPresentedViewController()
                .getCurrentViewController()
                .getCurrentController();
            if (vc?.constructor?.name !== 'UTStorePackViewController') return null;
            return vc.getView?.() || null;
        } catch {
            return null;
        }
    }
    function getSelectedPackIdFromFilter(view) {
        try {
            const opt = view?._fsufilterOption;
            const id = opt.id;
            if (typeof id !== 'number') return null;

            if (id > 1) return id;
            return null;
        } catch {
            return null;
        }
    }
    function getPacksNum() {
        const view = getCurrentStoreView();
        if (!view) return 0;

        const packsMap = view._fsuPacks;
        if (!packsMap || !Object.keys(packsMap).length) return 0;

        const packId = getSelectedPackIdFromFilter(view);
        if (!packId || !packsMap[packId]) return 0;

        return packsMap[packId].count || 0;
    }
    function _refreshUnassignedItems(controller, timeout = 20000) {
        return new Promise(async (resolve) => {

            const req = waitForRequest('/purchased/items', 'GET', 10000);


            await services.Item.itemDao.itemRepo.unassigned.reset();

            await controller.getUnassignedItems();

            await req;

            resolve();

        });
    }
    // v2.0.0
    async function _fetchSbcList() {
        const c = getAppMain()
            .getRootViewController()
            .getPresentedViewController()
            .getCurrentViewController()
            .getCurrentController()
        if (c.className != 'UTSBCHubViewController') {
            await clickIfExists('.ut-tab-bar-item.icon-sbc', 10000, 500);
            await waitAllEALoadingEnd();
        }
        const filteredSets = Object.values(services.SBC.repository.categories._collection)
            .filter(cat => cat.name === '升级')
            .flatMap(cat => cat.setIds)
            .map(id => services.SBC.repository.sets._collection[id])
            .filter(set =>
                targetKeywords.some(keyword => set.name.includes(keyword)) &&
                !set.name.includes('可交易') &&
                set.challengesCount === 1 && set.repeatabilityMode != "NON_REPEATABLE"
            );

        FILTERED_SETS = filteredSets || [];
        console.log('FILTERED_SETS', FILTERED_SETS);
        return FILTERED_SETS;
    }

    function getSbcById(id) {
        id = Number(id);
        return Object.values(services.SBC.repository.sets._collection || {}).find(s => s.id === id) || null;
    }


    async function _goToPacks() {
        const c = getAppMain()
            .getRootViewController()
            .getPresentedViewController()
            .getCurrentViewController()
            .getCurrentController()
        if (c.className != 'UTStorePackViewController') {
            await clickIfExists('.ut-tab-bar-item.icon-store', 10000, 500);
            await waitAllEALoadingEnd();
            if (repositories.Item.getUnassignedItems().length > 0) {
                alert('有未分配球员');
            }
            await clickIfExists('.packs-tile', 10000, 500);
            await waitAllEALoadingEnd();
        }
        return true
    }
    function SBCListPop(filteredSets, currentDoId, currentLoopId, preferColumn = null) {
        const el = (tag, className, props = {}) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            Object.assign(node, props);
            return node;
        };

        const buildRadioList = (items, name, currentId) => {
            const listBox = el('div', 'panda-col__list');
            items.forEach(s => {
                const row = el('label', 'panda-row');
                const r = el('input');
                r.type = 'radio';
                r.name = name;
                r.value = String(s.id);
                r.checked = String(currentId || '') === String(s.id);

                const span = el('span');
                span.textContent = s.name;

                row.appendChild(r);
                row.appendChild(span);
                listBox.appendChild(row);
            });
            return listBox;
        };

        const buildColumn = ({ title, tipHTML = '', name, items, currentId, highlight = false, clearText = '清除绑定' }) => {
            const col = el('div', 'panda-col' + (highlight ? ' panda-col--highlight' : ''));
            const titleEl = el('div', 'panda-col__title');

            if (tipHTML) {
                titleEl.innerHTML = `${title} ${tipHTML}`;
            } else {
                titleEl.textContent = title;
            }

            const listBox = buildRadioList(items, name, currentId);

            const spacer = document.createElement('div');
            spacer.style.height = '8px';

            const clearBtn = el('button', 'panda-btn', { textContent: clearText });
            clearBtn.onclick = () => {
                [...listBox.querySelectorAll('input[type="radio"]')].forEach(x => (x.checked = false));
            };

            col.append(titleEl, listBox, spacer, clearBtn);
            return col;
        };

        const loopAllowNames = ["10 名 85+ 升级", "10 名 84+ 升级"];
        const loopCandidates = filteredSets.filter(s => loopAllowNames.some(n => s.name.includes(n)));
        const doCandidates = filteredSets.filter(s => !loopAllowNames.some(n => s.name.includes(n)));
        const doList = doCandidates.length ? doCandidates : filteredSets;

        const mask = el('div', 'panda-modal-mask');
        const modal = el('div', 'panda-modal');
        mask.appendChild(modal);

        const hd = el('div', 'panda-modal__hd');
        const title = el('div', 'panda-modal__title', { textContent: '分配SBC' });
        const btnX = el('button', 'panda-modal__close');
        btnX.innerHTML = '×';
        hd.append(title, btnX);
        modal.appendChild(hd);

        const bd = el('div', 'panda-modal__bd');
        const colDo = buildColumn({
            title: '猛猛干（单选）',
            name: 'assign-do',
            items: doList,
            currentId: currentDoId,
            highlight: preferColumn === 'do',
        });
        const colLoop = buildColumn({
            title: '永动机（仅 10x85 / 10x84）',
            tipHTML: '<span class="panda-col__tip"></span>',
            name: 'assign-loop',
            items: loopCandidates,
            currentId: currentLoopId,
            highlight: preferColumn === 'loop',
        });
        bd.append(colDo, colLoop);
        modal.appendChild(bd);

        const ft = el('div', 'panda-modal__ft');
        const btnCancel = el('button', 'panda-btn', { textContent: '取消' });
        const btnOK = el('button', 'panda-btn panda-btn--ok', { textContent: '确定' });
        ft.append(btnCancel, btnOK);
        modal.appendChild(ft);
        const autoStartName =
            preferColumn === 'do' ? 'assign-do' :
                preferColumn === 'loop' ? 'assign-loop' : null;
        if (autoStartName) {
            bd.querySelectorAll(`input[name="${autoStartName}"]`).forEach(r => {
                r.addEventListener('change', () => {
                    btnOK.click();
                }, { once: true });
            });
        }
        return new Promise(resolve => {
            const close = (res) => {
                try { document.body.removeChild(mask); } catch { }
                resolve(res);
            };

            const onKey = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    btnOK.click();
                }
            };

            btnX.onclick = () => close(null);
            btnCancel.onclick = () => close(null);
            mask.addEventListener('click', (e) => { if (e.target === mask) close(null); });
            document.addEventListener('keydown', onKey);

            btnOK.onclick = () => {
                document.removeEventListener('keydown', onKey);

                const pick = (name) => {
                    const r = modal.querySelector(`input[name="${name}"]:checked`);
                    return r ? r.value : null;
                };

                const doId = pick('assign-do');
                const loopId = pick('assign-loop');
                close({ doId, loopId });
            };

            document.body.appendChild(mask);
            setTimeout(() => btnOK.focus(), 0);
        });
    }

    function _setPackFilterById(filterId, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const c = getAppMain()
                .getRootViewController()
                .getPresentedViewController()
                .getCurrentViewController()
                .getCurrentController();
            const view = c && c.getView && c.getView();
            if (!view || !view._fsufilterOption) {
                reject(new Error('FSU筛选不存在'));
                return;
            }
            const currentId = view._fsufilterOption.id

            if (Number(currentId) === Number(filterId)) {
                resolve({ success: true, id: filterId, skipped: true });
                return;
            }
            let finished = false;

            const onChange = () => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                view._fsufilterOption.removeTarget(view._fsufilterOption, EventType.CHANGE);
                resolve({ success: true, id: filterId });
            };

            view._fsufilterOption.addTarget(view._fsufilterOption, onChange, EventType.CHANGE);

            const timer = setTimeout(() => {
                if (finished) return;
                finished = true;
                view._fsufilterOption.removeTarget(view._fsufilterOption, EventType.CHANGE);
                reject(new Error('设置筛选超时'));
            }, timeout);

            view._fsufilterOption.setIndexById(Number(filterId));
        });
    }
    function resolveSBCSetStrict({ setId, categoryName, setName }) {
        const categoriesArr = Object.values(services.SBC.repository.categories._collection || {});
        const setsArr = Object.values(services.SBC.repository.sets._collection || {});

        if (setId != null) {
            const s = setsArr.find(x => x.id === Number(setId));
            if (!s) throw new Error(`找不到setId=${setId}对应的 SBC`);
            return s;
        }

        let pool = setsArr;
        if (categoryName) {
            const cat = categoriesArr.find(c => c.name === categoryName);
            if (!cat) throw new Error(`找不到分类: ${categoryName}`);
            const idSet = new Set(cat.setIds || []);
            pool = pool.filter(s => idSet.has(s.id));
        }

        if (setName) {
            let found = pool.find(s => s.name === setName);
            if (!found) found = pool.find(s => s.name && s.name.includes(setName));
            if (!found) throw new Error(`找不到名为/包含${setName}的 SBC`);
            return found;
        }

        if (!pool.length) throw new Error(`没有可用的SBC）`);
        return pool[0];
    }

    async function _pushSBCSet(sbcSet, { timeout = 15000 } = {}) {
        const controller = cntlr.current && cntlr.current();
        const view = controller && controller.getView && controller.getView();
        if (!controller || !view) throw new Error('[pushSBCSet] 无法获得当前 controller/view');

        try { view.setInteractionState && view.setInteractionState(false); } catch { }

        const challengesResp = await new Promise((resolve, reject) => {
            let done = false;
            const t = setTimeout(() => { if (!done) reject(new Error('requestChallengesForSet超时')); }, timeout);
            services.SBC.requestChallengesForSet(sbcSet).observe(controller, (e, resp) => {
                done = true;
                try { e.unobserve(controller); } catch { }
                clearTimeout(t);
                if (!resp || !resp.success) return reject(new Error(`requestChallengesForSet失败`));
                if (!resp.data?.challenges?.length) return reject(new Error(`该SBC暂无挑战`));
                resolve(resp);
            });
        });

        const nav = controller.getNavigationController && controller.getNavigationController();
        if (!nav) throw new Error('无导航控制器');

        if (sbcSet.hidden) {
            const first = challengesResp.data.challenges[0];

            await new Promise((resolve, reject) => {
                let done = false;
                const t = setTimeout(() => { if (!done) reject(new Error('loadChallenge超时')); }, timeout);
                services.SBC.loadChallenge(first).observe(controller, (ee, rr) => {
                    done = true;
                    try { ee.unobserve(controller); } catch { }
                    clearTimeout(t);
                    if (!rr || !rr.success) return reject(new Error('loadChallenge失败'));
                    resolve();
                });
            });

            try {
                const ch = sbcSet.getChallenge && sbcSet.getChallenge(first.id);
                if (ch && !ch.squad) ch.update && ch.update(first);
            } catch { }

            const vc = new UTSBCSquadSplitViewController();
            vc.initWithSBCSet && vc.initWithSBCSet(sbcSet, first.id);
            nav.pushViewController && nav.pushViewController(vc);
        } else {
            const vc = new UTSBCGroupChallengeSplitViewController();
            vc.initWithSBCSet && vc.initWithSBCSet(sbcSet);
            nav.pushViewController && nav.pushViewController(vc, true);
            try { nav.setNavigationTitle && nav.setNavigationTitle(sbcSet.name); } catch { }
        }

        try { view.setInteractionState && view.setInteractionState(true); } catch { }
        return true;
    }

    async function _goToSBC(opts = {}) {
        const set = resolveSBCSetStrict(opts);
        return pushSBCSet(set, { timeout: 15000 });
    }
    function getPackIdFromSbc(sbcSet) {
        try { return Number(sbcSet?.awards?.[0]?.value) || null; } catch { return null; }
    }
    async function _setPackFilter(retryCount = 0) {
        if (!selectedLoopSetId) return false;

        const set = getSbcById(selectedLoopSetId);
        if (!set) return false;

        const packId = getPackIdFromSbc(set);
        if (!packId) return false;

        try {
            await setPackFilterById(packId, 2000);
            return true;
        } catch (e) {
            console.warn('设置筛选失败', e);

            if (retryCount >= 1) {
                console.warn('已重试一次，仍失败');
                return false;
            }

            const oldSelectedDo = selectedDoSbcSetId;
            selectedDoSbcSetId = selectedLoopSetId;
            try {
                await doSBC();
            } catch (err) {
                console.error('doSBC失败', err);
            } finally {
                selectedDoSbcSetId = oldSelectedDo;
            }

            return await _setPackFilter(retryCount + 1);
        }
    }
    async function ensureConfigThenAssign(kind) {
        if (!FILTERED_SETS.length) {
            alert('未获取配置');
            return;
        }

        const res = await SBCListPop(FILTERED_SETS, selectedDoSbcSetId, selectedLoopSetId, kind || null);
        if (!res) return;

        selectedDoSbcSetId = res.doId
        selectedLoopSetId = res.loopId
        if (kind === 'do' && res.doId) {
            if (running && runningTask !== 'doSBC') await stopLoopAsync();
            if (!running) {
                const c = getAppMain()
                    .getRootViewController()
                    .getPresentedViewController()
                    .getCurrentViewController()
                    .getCurrentController()
                if (c.className != 'UTSBCHubViewController') {
                    await clickIfExists('.ut-tab-bar-item.icon-sbc', 10000, 500);
                    await waitAllEALoadingEnd();
                }
                startSBC();
            }
        } else if (kind === 'loop' && res.loopId) {
            if (running && runningTask !== 'loop') await stopLoopAsync();
            if (!running) {
                await goToPacks();
                startLoop()
            };
        }
    }

    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }
    //v2.0.4
    function countPlayersInRange(players, range, excludeSet) {
        const [min, max] = range;
        return players.reduce((n, p) => {
            if (
                (!range || (p.rating >= min && p.rating <= max)) &&
                Array.isArray(p.groups) &&
                !p.groups.includes(23) &&
                !excludeSet.has(p.id)
            ) {
                return n + 1;
            }
            return n;
        }, 0);
    }

    function updateStatsUI() {
        try {
            const clubItemsIter = repositories?.Item?.club?.items?.values?.();
            const clubItems = clubItemsIter ? Array.from(clubItemsIter) : [];
            const storageItems = repositories?.Item?.getStorageItems?.() || [];

            const isValidPlayer = (p) =>
                p?.isPlayer?.() &&
                p.loans === -1 &&
                !p.isEnrolledInAcademy?.() &&
                p.endTime === -1;

            const clubPlayers = clubItems.filter(isValidPlayer);
            const storagePlayers = storageItems.filter(isValidPlayer);
            const allPlayers = clubPlayers.concat(storagePlayers);

            const excludeIds = page.info.lock || [];
            const excludeSet = new Set(excludeIds);

            ranges.forEach(cfg => {
                let val = 0;
                let id;
                if (cfg.type === 'all') {
                    val = countPlayersInRange(allPlayers, cfg.range, excludeSet);
                    id = `stat-${cfg.range[0]}-${cfg.range[1]}`;
                } else {
                    val = storagePlayers.length;
                    id = 'stat-storage';
                }
                const node = document.getElementById(id);
                if (node) node.textContent = String(val);
            });
        } catch (err) {
            console.warn('[pandaSBC] 更新统计失败', err);
        }
    }
    const sleep = makeAbortable(_sleep);
    const waitForElement = makeAbortable(_waitForElement);
    const waitForRequest = makeAbortable(_waitForRequest);
    const waitEALoadingEnd = makeAbortable(_waitEALoadingEnd);
    const waitForController = makeAbortable(_waitForController);
    const waitAndClickQuickSellUntradeableBtn = makeAbortable(_waitAndClickQuickSellUntradeableBtn);
    const waitForLoadingStart = makeAbortable(_waitForLoadingStart);
    const waitFSULoading = makeAbortable(_waitFSULoading);
    const clickIfExists = makeAbortable(_clickIfExists);
    const waitForElementGone = makeAbortable(_waitForElementGone);
    const addPlayer = makeAbortable(_addPlayer);
    const moveItems = makeAbortable(_moveItems);
    const handleUnassigned = makeAbortable(_handleUnassigned);
    const openPacks = makeAbortable(_openPacks);
    const findBtnByText = makeAbortable(_findBtnByText)
    const waitAllEALoadingEnd = makeAbortable(_waitAllEALoadingEnd);
    const handleUnassignedDuplicate = makeAbortable(_handleUnassignedDuplicate);
    const goToPacks = makeAbortable(_goToPacks);
    const forceLoop = makeAbortable(_forceLoop);
    const doSBC = makeAbortable(_doSBC);
    const pushSBCSet = makeAbortable(_pushSBCSet);
    const goToSBC = makeAbortable(_goToSBC);
    const fetchSbcList = makeAbortable(_fetchSbcList);
    const setPackFilter = makeAbortable(_setPackFilter);
    const setPackFilterById = makeAbortable(_setPackFilterById);
    const refreshUnassignedItems = makeAbortable(_refreshUnassignedItems);
    function startLoop() {
        startAsyncTask({
            button: btnLoop,
            taskName: 'loop',
            asyncLoop: forceLoop,
            startText: '永动机',
            stopText: '停止循环',
            randomPause: [500, 1000],
            pauseEveryRange: [35, 45],
            bigPauseRange: [20000, 30000]
        });
    }

    function startOpenPacks() {
        startAsyncTask({
            button: btnOpenPacks,
            taskName: 'openPacks',
            asyncLoop: openPacks,
            startText: '开包',
            stopText: '停止开包',
            countLimit: () => getPacksNum(),
            randomPause: [1000, 1500]
        });
    }

    function startSBC() {
        startAsyncTask({
            button: btnDoSbc,
            taskName: 'doSBC',
            asyncLoop: doSBC,
            startText: '猛猛干',
            stopText: '不干了',
            randomPause: [500, 1000],
            pauseEveryRange: [35, 45],
            bigPauseRange: [20000, 30000]
        });
    }
    async function stopLoopAsync() {
        if (!isStopping) {
            isStopping = true;
            updateButtonState();
        }

        if (running) {
            running = false;
            runningTask = '';
            if (abortCtrl) abortCtrl.abort();
        }

        const minHold = new Promise(r => setTimeout(r, 300));
        try { await Promise.all([currentTaskDone.catch(() => { }), minHold]); }
        finally {
            isStopping = false;
            btnLoop.textContent = '永动机';
            btnOpenPacks.textContent = '开包';
            btnDoSbc.textContent = '猛猛干';
            updateButtonState();
        }
    }
    function stopLoop() {
        stopLoopAsync();
    }
    function updateButtonState() {
        if (!btnLoop || !btnOpenPacks || !btnDoSbc) return;

        if (isStopping) {
            btnLoop.disabled = true;
            btnOpenPacks.disabled = true;
            btnDoSbc.disabled = true;

            btnLoop.textContent = '停止中…';
            btnOpenPacks.textContent = '停止中…';
            btnDoSbc.textContent = '停止中…';
            return;
        }

        if (running) {
            if (runningTask === 'loop') {
                btnLoop.disabled = false;
                btnOpenPacks.disabled = true;
                btnDoSbc.disabled = true;
                btnLoop.textContent = '停止循环';
            } else if (runningTask === 'openPacks') {
                btnOpenPacks.disabled = false;
                btnLoop.disabled = true;
                btnDoSbc.disabled = true;
                btnOpenPacks.textContent = '停止开包';
            } else if (runningTask === 'doSBC') {
                btnDoSbc.disabled = false;
                btnLoop.disabled = true;
                btnOpenPacks.disabled = true;
                btnDoSbc.textContent = '不干了';
            }
        } else {
            btnLoop.disabled = false;
            btnOpenPacks.disabled = false;
            btnDoSbc.disabled = false;
            btnLoop.textContent = '永动机';
            btnOpenPacks.textContent = '开包';
            btnDoSbc.textContent = '猛猛干';
        }
    }
    function startAsyncTask({
        button, taskName, asyncLoop, startText, stopText,
        countLimit, randomPause, pauseEveryRange, bigPauseRange
    }) {
        if (running) return;
        running = true;
        if (['openPacks', 'loop'].includes(taskName)) _hiRatedPlayers = [];
        runningTask = taskName;
        updateButtonState();
        button.textContent = stopText;

        let _doneResolve;
        currentTaskDone = new Promise(r => (_doneResolve = r));
        abortCtrl = new AbortController();
        console.log('start', taskName);
        (async () => {
            try {
                let count = 0;
                let pauseEvery = pauseEveryRange
                    ? pauseEveryRange[0] + Math.floor(Math.random() * (pauseEveryRange[1] - pauseEveryRange[0] + 1))
                    : 0;
                let pauseTime = bigPauseRange
                    ? bigPauseRange[0] + Math.floor(Math.random() * (bigPauseRange[1] - bigPauseRange[0] + 1))
                    : 0;
                while (running && !abortCtrl.signal.aborted) {
                    if (countLimit != null) {
                        const remainingRaw = typeof countLimit === 'function'
                            ? await Promise.resolve(countLimit())
                            : countLimit;
                        const remaining = Number(remainingRaw);
                        console.log('remaining--------------', remaining);
                        if (!Number.isFinite(remaining) || remaining <= 0) break;
                    }

                    let canContinue = await asyncLoop();
                    if (canContinue === false) break;
                    count++;
                    if (pauseEvery && count >= pauseEvery) {
                        for (let s = Math.floor(pauseTime / 1000); s > 0; s--) {
                            if (!running || abortCtrl.signal.aborted) break;
                            button.textContent = `等待${s}秒`;
                            await sleep(1000);
                        }
                        button.textContent = stopText;
                        pauseEvery = pauseEveryRange
                            ? pauseEveryRange[0] + Math.floor(Math.random() * (pauseEveryRange[1] - pauseEveryRange[0] + 1))
                            : pauseEvery;
                        pauseTime = bigPauseRange
                            ? bigPauseRange[0] + Math.floor(Math.random() * (bigPauseRange[1] - bigPauseRange[0] + 1))
                            : pauseTime;
                        count = 0;
                    }
                    if (randomPause) {
                        await sleep(randomPause[0] + Math.random() * (randomPause[1] - randomPause[0]));
                    }
                }
            } catch (e) {
                console.error(`[${taskName}] 中断：`, e && e.message);
            } finally {
                running = false;
                runningTask = '';
                abortCtrl = null;
                button.textContent = startText;
                updateButtonState();
                if (['openPacks', 'loop'].includes(taskName)) {
                    _showHiRatedPopup(`本次高分球员（≥${highRatingPlayerThreshold}）`);
                }
                _doneResolve();
            }
        })();
    }

    function initControlPanel() {
        if (document.getElementById('panda-dock')) return;

        const isLikeNode = (el) => el && (el.nodeType === 1 || el.nodeType === 3 || el.nodeType === 11);
        const adoptIntoDoc = (el) => {
            if (!isLikeNode(el)) return null;
            try { return document.adoptNode ? document.adoptNode(el) : el; } catch { }
            try { return document.importNode ? document.importNode(el, true) : el.cloneNode(true); } catch { }
            return el;
        };

        const el = (tag, className, props = {}) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            Object.assign(node, props);
            return node;
        };

        const panel = el('div');
        panel.id = 'sbc-panel';

        const inputBox = el('input', 'sbc-input', {
            type: 'number',
            value: minRating,
            min: 80,
            max: 99,
            title: '最低评分阈值',
        });
        inputBox.onchange = () => {
            const v = Math.floor(Number(inputBox.value));
            if (Number.isFinite(v) && v >= 45 && v <= 99) {
                minRating = v;
                GM_setValue(MIN_RATING_KEY, v);
            } else {
                inputBox.value = minRating;
            }
        };

        const makeBtn = (text, extraClass, id) =>
            el('button', `sbc-btn ${extraClass}`, { textContent: text, id });
        function makeStatCard(cfg) {
            const card = document.createElement('div');
            card.className = 'sbc-stat-card';

            let label, id;
            if (cfg.type === 'storage') {
                label = '仓库';
                id = 'stat-storage';
            } else {
                label = `${cfg.range[0]}–${cfg.range[1]}`;
                id = `stat-${cfg.range[0]}-${cfg.range[1]}`;
            }

            card.innerHTML = `
        <div class="sbc-stat-label">${label}</div>
        <div class="sbc-stat-value" id="${id}">0</div>
    `;
            return card;
        }

        const statsBox = el('div', 'sbc-stats');
        ranges.forEach(cfg => statsBox.appendChild(makeStatCard(cfg)));

        btnDoSbc = makeBtn('猛猛干', 'sbc-btn--do', 'btn-do-sbc');
        btnDoSbc.onclick = async () => {
            if (isStopping) return;
            if (running && runningTask === 'doSBC') {
                stopLoop();
                return;
            }
            if (running && runningTask !== 'doSBC') {
                await stopLoopAsync();
            }
            await ensureConfigThenAssign('do');
        };

        btnOpenPacks = makeBtn('开包', 'sbc-btn--open', 'btn-open-packs');
        btnOpenPacks.onclick = async () => {
            if (isStopping) return;
            if (running && runningTask !== 'openPacks') await stopLoopAsync();
            if (!running) startOpenPacks();
            else if (runningTask === 'openPacks') stopLoop();
        };

        btnLoop = makeBtn('永动机', 'sbc-btn--loop', 'btn-loop');
        btnLoop.onclick = async () => {
            if (isStopping) return;
            if (!selectedLoopSetId) {
                await ensureConfigThenAssign('loop');
                return;
            }
            if (running && runningTask !== 'loop') await stopLoopAsync();
            if (!running) {
                await goToPacks();
                startLoop();
            }
            else if (runningTask === 'loop') stopLoop();
        };

        const chkHandleDup = el('input', 'sbc-chk', {
            type: 'checkbox',
            checked: enableHandleDuplicate,
        });
        chkHandleDup.onchange = () => {
            enableHandleDuplicate = chkHandleDup.checked;
            GM_setValue('enableHandleDuplicate', enableHandleDuplicate);
        };

        const chkLabel = el('label', 'sbc-chklabel');
        chkLabel.appendChild(chkHandleDup);
        chkLabel.appendChild(document.createTextNode('提前分配重复球员'));

        const btnAssign = el('button', 'sbc-btn sbc-btn--assign', { textContent: '获取配置' });
        btnAssign.onclick = async () => {
            const originalText = btnAssign.textContent;
            try {
                if (!FILTERED_SETS.length) {
                    btnAssign.disabled = true;
                    btnAssign.textContent = '获取中…';

                    const sets = await fetchSbcList();
                    const list = Array.isArray(sets) ? sets : FILTERED_SETS;

                    if (Array.isArray(list) && list.length > 0) {
                        btnAssign.textContent = '分配SBC';
                        return;
                    } else {
                        btnAssign.textContent = originalText;
                        return;
                    }
                }
                await ensureConfigThenAssign();
            } catch (e) {
                btnAssign.textContent = originalText;
                alert('获取配置失败，请稍后重试');
            } finally {
                btnAssign.disabled = false;
            }
        };
        panel.appendChild(statsBox);
        panel.appendChild(inputBox);
        panel.appendChild(btnDoSbc);
        panel.appendChild(btnOpenPacks);
        panel.appendChild(btnLoop);
        panel.appendChild(btnAssign);
        panel.appendChild(chkLabel);

        let side = GM_getValue('pandaDockSide', 'right');
        let top = Number(GM_getValue('pandaDockTop', 140)) || 140;
        let autohide = GM_getValue('pandaDockAutohide', false);

        const dock = document.createElement('div');
        dock.id = 'panda-dock';
        dock.className = side;
        dock.style.top = `${top}px`;

        const handle = document.createElement('div');
        handle.className = 'dock-handle';
        handle.title = '点击展开/收起；拖动上下移动；双击切换左右';
        handle.textContent = `PANDA SBC v${version}`;

        const panelWrap = document.createElement('div');
        panelWrap.className = 'dock-panel';

        const safePanel = adoptIntoDoc(panel) || panel;
        try { panelWrap.appendChild(safePanel); }
        catch {
            const imported = document.importNode ? document.importNode(safePanel, true) : safePanel.cloneNode(true);
            panelWrap.appendChild(imported);
        }

        const foot = document.createElement('div');
        foot.className = 'dock-foot';
        const toggle = document.createElement('span');
        toggle.className = 'dock-toggle';
        const setAutoText = () => toggle.textContent = autohide ? '自动隐藏：开' : '自动隐藏：关';
        setAutoText();
        toggle.onclick = () => {
            autohide = !autohide;
            GM_setValue('pandaDockAutohide', autohide);
            setAutoText();
            if (!autohide) expand(); else collapse();
        };
        foot.appendChild(toggle);
        panelWrap.appendChild(foot);

        if (side === 'right') { dock.appendChild(panelWrap); dock.appendChild(handle); }
        else { dock.appendChild(handle); dock.appendChild(panelWrap); }

        document.body.appendChild(dock);

        let expanded = !autohide;
        const expand = () => {
            dock.classList.add('expanded');
            expanded = true;
        };
        const collapse = () => {
            if (autohide) {
                dock.classList.remove('expanded'); expanded = false;
            }
        };
        if (expanded) dock.classList.add('expanded');

        let hovering = false;
        let leaveTimer = null;
        let clickTimer = null;
        let ignoreLeaveUntil = 0;

        dock.addEventListener('pointerenter', () => {
            hovering = true;
            if (autohide) expand();
            if (leaveTimer) clearTimeout(leaveTimer);
        });
        dock.addEventListener('pointerleave', () => {
            hovering = false;
            if (!autohide) return;
            if (Date.now() < ignoreLeaveUntil) return;
            if (leaveTimer) clearTimeout(leaveTimer);
            leaveTimer = setTimeout(() => { if (!hovering) collapse(); }, 220);
        });

        handle.addEventListener('click', (e) => {
            if (e.detail > 1) return;
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                expanded ? collapse() : expand();
                clickTimer = null;
            }, 180);
        });

        handle.addEventListener('dblclick', () => {
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }

            side = (side === 'right') ? 'left' : 'right';
            GM_setValue('pandaDockSide', side);
            dock.classList.remove('left', 'right');
            dock.classList.add(side);

            panelWrap.remove(); handle.remove();
            if (side === 'right') {
                dock.appendChild(panelWrap);
                dock.appendChild(handle);
            } else {
                dock.appendChild(handle);
                dock.appendChild(panelWrap);
            }

            expand();
            ignoreLeaveUntil = Date.now() + 300;

            setTimeout(() => {
                if (autohide && !hovering) collapse();
            }, 350);
        });

        let dragging = false, startY = 0, startTop = 0;
        const onMove = (e) => {
            if (!dragging) return;
            const dy = e.clientY - startY;
            const newTop = Math.max(20, Math.min(page.innerHeight - 160, startTop + dy));
            dock.style.top = `${newTop}px`;
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            dock.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            GM_setValue('pandaDockTop', parseInt(dock.style.top, 10) || 140);
        };
        handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            dragging = true;
            dock.classList.add('dragging');
            startY = e.clientY;
            startTop = parseInt(dock.style.top || '140', 10) || 140;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        document.addEventListener('mouseout', (e) => {
            if (!autohide) return;
            if (e.relatedTarget == null) {
                hovering = false;
                collapse();
            }
        });
        document.addEventListener('pointermove', (e) => {
            if (!autohide || !expanded) return;
            const margin = 8;
            if (side === 'right' && e.clientX < page.innerWidth - 240 - margin && !hovering) collapse();
            if (side === 'left' && e.clientX > 240 + margin && !hovering) collapse();
        });
        page.addEventListener('blur', () => { if (autohide) collapse(); });

        page.addEventListener('resize', () => {
            const curTop = parseInt(dock.style.top || '140', 10) || 140;
            const maxTop = Math.max(20, page.innerHeight - 160);
            if (curTop > maxTop) {
                dock.style.top = `${maxTop}px`;
                GM_setValue('pandaDockTop', maxTop);
            }
        });

        updateButtonState();
    }


    page.addEventListener('load', () => {
        initControlPanel()
    });
})();
