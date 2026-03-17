// JavaScript source code
// ==UserScript==
// @name         my_spdata_configurable
// @namespace    http://tampermonkey.net/
// @version      2026-03-17
// @description  Zeigt verbleibende Arbeitszeit mit konfigurierbaren Pausen & Einstellungsdialog in my_spdata an.
// @author       weaseldev
// @match        https://myspdata.duerkopp.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duerkopp.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const defaultConfig = {
        workingTime: [7.75, 7.75, 7.75, 6.75, 5],
        breaks: [
            { start: 9.0, end: 9.25 },
            { start: 12.75, end: 13.25 }
        ]
    };

    function loadConfig() {
        try {
            const stored = JSON.parse(localStorage.getItem("myspdata_config"));
            if (stored?.workingTime?.length === 5 && Array.isArray(stored.breaks)) {
                return stored;
            }
        } catch (e) { }
        return defaultConfig;
    }

    function saveConfig(config) {
        localStorage.setItem("myspdata_config", JSON.stringify(config));
    }

    let config = loadConfig();

    const DEBUG = false;

    const vollPausenZeit = () => config.breaks.reduce((sum, p) => sum + (p.end - p.start), 0);

    function timeStrToNum(str) {
        if (str == null) return NaN;
        const s = String(str).trim().replace(",", ".");
        if (s === "") return NaN;
        // format HH:MM
        if (s.includes(":")) {
            const parts = s.split(":");
            const h = parseFloat(parts[0].replace(/[^0-9\-\.\+]/g, ""));
            const m = parts[1] ? parseFloat(parts[1].replace(/[^0-9\-\.\+]/g, "")) : 0;
            if (isNaN(h)) return NaN;
            return h + (isNaN(m) ? 0 : m / 60);
        }
        // decimal hours like "7.5" or "7,5"
        const v = parseFloat(s.replace(/[^0-9\-\.\+]/g, ""));
        return isNaN(v) ? NaN : v;
    }

    function decTimeToString(decTime) {
        const negative = decTime < 0;
        if (negative) decTime = -decTime;
        let h = Math.floor(decTime);
        let m = Math.round((decTime - h) * 60);
        if (m === 60) { h += 1; m = 0; }
        const ms = ("00" + m).slice(-2);
        return `${negative ? '-' : ''}${h}:${ms}`;
    }

    function berechnePause(starts, stops) {
        let pause = 0;
        for (let i = 0; i < starts.length; i++) {
            const s = starts[i], e = stops[i];
            for (const p of config.breaks) {
                if (s < p.start && e > p.end) pause += p.end - p.start;
                else if (s < p.start && e > p.start && e < p.end) pause += (e - p.start);
                else if (e > p.end && s > p.start && s < p.end) pause += (p.end - s);
            }
        }
        return pause;
    }

    function soLangeNoch() {
        console.log("ping")
        const bookingTable = document.querySelector(".ag-body");
        if (!bookingTable) return;

        const today = new Date();
        const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayIndex);
        weekStart.setHours(0, 0, 0, 0);

        const startWoche = [], stopWoche = [], startHeute = [], stopHeute = [];

        const rows = bookingTable.querySelectorAll(".ag-row");
        for (let i = rows.length - 1; i >= 0; i--) {
            try {
                const cols = rows[i].children;
                if (!cols || cols.length < 3) continue;
                const dateText = cols[0].innerText.trim();
                const dateParts = dateText.split(".");
                if (dateParts.length !== 3) continue;
                const [d, m, y] = dateParts;
                const date = new Date(`${y}-${m}-${d}`);
                if (isNaN(date.getTime())) continue;
                const type = cols[1].innerText.trim();
                if (type !== "Kommen" && type !== "Gehen") continue;
                const time = timeStrToNum(cols[2].innerText);
                if (!isFinite(time) || time < 0 || time >= 24) continue;

                if (date >= weekStart) {
                    if (type === "Kommen") {
                        startWoche.push(time);
                        if (date.getDate() === today.getDate()) startHeute.push(time);
                    } else if (type === "Gehen") {
                        stopWoche.push(time);
                        if (date.getDate() === today.getDate()) stopHeute.push(time);
                    }
                }
            } catch (err) {
                // ignore malformed row and continue parsing the rest
                continue;
            }
        }

        const now = new Date();
        const nowTime = now.getHours() + now.getMinutes() / 60;

        if (stopWoche.length < startWoche.length) stopWoche.push(nowTime);
        if (stopHeute.length < startHeute.length) stopHeute.push(nowTime);

        const pauseWoche = berechnePause(startWoche, stopWoche);
        const pauseHeute = berechnePause(startHeute, stopHeute);
        const arbeitWoche = stopWoche.reduce((a, b) => a + b, 0) - startWoche.reduce((a, b) => a + b, 0) - pauseWoche;
        const arbeitHeute = stopHeute.reduce((a, b) => a + b, 0) - startHeute.reduce((a, b) => a + b, 0) - pauseHeute;
        const restHeute = config.workingTime[dayIndex] - arbeitHeute;

        const startTimeToday = startHeute.length ? Math.min(...startHeute) : nowTime;
        const endeVollPause = startTimeToday + config.workingTime[dayIndex] + vollPausenZeit();

        const weekTarget = config.workingTime.reduce((a, b) => a + b, 0);
        const restWoche = weekTarget - arbeitWoche;

        // ensure table is present as its own li before the config button
        let display = document.getElementById("timeLeft");
        if (!display) {
            const table = document.createElement("table");
            table.id = "timeLeft";
            table.style = "font-size:14px; font-family:Tahoma; margin-top:-6px; background:transparent; color:inherit; border-collapse:collapse;";
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="padding:4px 8px;text-align:left;color:inherit;background:transparent;border:none"></th>
                        <th style="padding:4px 8px;text-align:left;color:inherit;background:transparent;border:none">Laufend</th>
                        <th style="padding:4px 8px;text-align:left;color:inherit;background:transparent;border:none">Verbleibend</th>
                        <th style="padding:4px 8px;text-align:left;color:inherit;background:transparent;border:none">Feierabend</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding:4px 8px">Heute</td>
                        <td id="tl_today_running" style="padding:4px 8px"></td>
                        <td id="tl_today_remaining" style="padding:4px 8px"></td>
                        <td id="tl_today_end" style="padding:4px 8px"></td>
                    </tr>
                    <tr>
                        <td style="padding:4px 8px">Woche</td>
                        <td id="tl_week_running" style="padding:4px 8px"></td>
                        <td id="tl_week_remaining" style="padding:4px 8px"></td>
                        <td id="tl_week_end" style="padding:4px 8px"></td>
                    </tr>
                </tbody>
            `;

            const navList = document.querySelector('#navbar-mobile ul.nav.navbar-nav.float-right') || document.querySelector('ul.nav.navbar-nav.float-right') || document.querySelector('ul.nav.float-right') || document.querySelector('#navbar-mobile > ul');
            if (navList) {
                const tableLi = document.createElement('li');
                tableLi.className = 'nav-item';
                tableLi.style = 'display:flex;align-items:center;margin-right:8px;';
                tableLi.appendChild(table);
                // insert before config button if present, otherwise before wrench
                const cfgLi = navList.querySelector('#mysp_cfg_li');
                const wrenchLi = navList.querySelector('li.dashboardIcon');
                if (cfgLi) navList.insertBefore(tableLi, cfgLi);
                else if (wrenchLi) navList.insertBefore(tableLi, wrenchLi);
                else navList.appendChild(tableLi);
            } else {
                // fallback: attach to body fixed near top-right
                const fallback = document.createElement('div');
                fallback.style = 'position:fixed;top:8px;right:64px;z-index:9999;background:rgba(0,0,0,0.6);padding:4px;border-radius:4px;';
                fallback.appendChild(table);
                document.body.appendChild(fallback);
            }

            display = table;
        }

        display.style.color = (restHeute > 0 && restWoche > 0) ? "lightgreen" : "#FFAB57";
        display.title = "Zeigt verbleibende Arbeitszeit (mit aktueller oder voller Pause)";

        const setCell = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        };

        setCell('tl_today_running', `${decTimeToString(Math.abs(arbeitHeute))} h`);
        setCell('tl_today_remaining', `${decTimeToString(Math.abs(restHeute))} h`);
        setCell('tl_today_end', `${decTimeToString(endeVollPause)} Uhr`);

        setCell('tl_week_running', `${decTimeToString(arbeitWoche)} h`);
        setCell('tl_week_remaining', `${decTimeToString(restWoche)} h`);
        setCell('tl_week_end', '');
    }

    function addSettingsButton() {
        // avoid adding the button twice
        if (document.getElementById('mysp_cfg_btn')) return;

        const button = document.createElement("button");
        button.id = 'mysp_cfg_btn';
        button.innerText = "⚙️";
        button.title = "Konfiguration öffnen";
        button.style = "font-size: 20px; border: none; background: transparent; color: inherit; cursor: pointer;";
        button.setAttribute('aria-label', 'Konfiguration öffnen');
        button.onclick = openSettingsDialog;
        // try to place into the header navbar right-side list
        let navList = document.querySelector('#navbar-mobile ul.nav.navbar-nav.float-right') || document.querySelector('ul.nav.navbar-nav.float-right') || document.querySelector('ul.nav.float-right') || document.querySelector('#navbar-mobile > ul');
        if (navList) {
            const li = document.createElement('li');
            li.id = 'mysp_cfg_li';
            li.className = 'nav-item';
            li.style = 'display:flex;align-items:center;';
            li.appendChild(button);
            const wrenchLi = navList.querySelector('li.dashboardIcon');
            if (wrenchLi) navList.insertBefore(li, wrenchLi);
            else navList.appendChild(li);
            return;
        }
        // fallback: fixed container in top-right
        const fallback = document.createElement("div");
        fallback.style = "position:fixed;top:8px;right:8px;z-index:9999;";
        fallback.appendChild(button);
        document.body.appendChild(fallback);
    }

    function openSettingsDialog() {
        const overlay = document.createElement("div");
        overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:#00000088;z-index:10000;display:flex;justify-content:center;align-items:center;";

        const dialog = document.createElement("div");
        dialog.style = "background:white;padding:20px;border-radius:10px;min-width:400px;font-family:Tahoma;";

        const html = `
            <h3>Konfiguration</h3>
            <label>Tägliche Arbeitszeit (Mo–Fr):</label><br>
            ${config.workingTime.map((w, i) =>
            `<input id="w${i}" value="${w.toFixed(2)}" size="4">`
        ).join(" ")}<br><br>

            <label>Pausen (Start - Ende):</label><br>
            ${config.breaks.map((b, i) => `
                <input id="b${i}start" value="${b.start.toFixed(2)}" size="4"> -
                <input id="b${i}end" value="${b.end.toFixed(2)}" size="4"><br>
            `).join("")}
            <br>
            <button id="saveCfg">Speichern</button>
            <button id="cancelCfg">Abbrechen</button>
        `;

        dialog.innerHTML = html;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        document.getElementById("cancelCfg").onclick = () => document.body.removeChild(overlay);

        document.getElementById("saveCfg").onclick = () => {
            const newCfg = {
                workingTime: [],
                breaks: []
            };
            for (let i = 0; i < 5; i++) {
                const val = parseFloat(document.getElementById(`w${i}`).value.replace(",", "."));
                newCfg.workingTime.push(isNaN(val) ? defaultConfig.workingTime[i] : val);
            }
            for (let i = 0; i < config.breaks.length; i++) {
                const start = parseFloat(document.getElementById(`b${i}start`).value.replace(",", "."));
                const end = parseFloat(document.getElementById(`b${i}end`).value.replace(",", "."));
                newCfg.breaks.push({
                    start: isNaN(start) ? config.breaks[i].start : start,
                    end: isNaN(end) ? config.breaks[i].end : end
                });
            }
            config = newCfg;
            saveConfig(config);
            document.body.removeChild(overlay);
            soLangeNoch();
        };
    }

    // === Initialisierung ===
    function initializeWhenReady() {
        if (document.querySelector('.ag-body')) {
            soLangeNoch();
            window.setInterval(soLangeNoch, 20000);
            addSettingsButton();
            return true;
        }
        return false;
    }

    // quick path: if already present
    if (!initializeWhenReady()) {
        const observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector('.ag-body')) {
                obs.disconnect();
                soLangeNoch();
                window.setInterval(soLangeNoch, 20000);
                addSettingsButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();


