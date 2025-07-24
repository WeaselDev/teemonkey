// ==UserScript==
// @name         my_spdata_configurable
// @namespace    http://tampermonkey.net/
// @version      2025-07-24
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
        } catch (e) {}
        return defaultConfig;
    }

    function saveConfig(config) {
        localStorage.setItem("myspdata_config", JSON.stringify(config));
    }

    let config = loadConfig();

    const vollPausenZeit = () => config.breaks.reduce((sum, p) => sum + (p.end - p.start), 0);

    function timeStrToNum(str) {
        const [h, m] = str.split(":");
        return parseFloat(h) + (parseFloat(m) || 0) / 60;
    }

    function decTimeToString(decTime) {
        const h = Math.floor(decTime);
        const m = ("00" + Math.round((decTime - h) * 60)).slice(-2);
        return `${h}:${m}`;
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
        const bookingTable = document.querySelector("#bookings tbody");
        if (!bookingTable) return;

        const today = new Date();
        const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayIndex);
        weekStart.setHours(0, 0, 0, 0);

        const startWoche = [], stopWoche = [], startHeute = [], stopHeute = [];

        const rows = bookingTable.querySelectorAll("tr");
        for (let i = rows.length - 1; i >= 0; i--) {
            const cols = rows[i].children;
            const [d, m, y] = cols[0].innerText.split(".");
            const date = new Date(`${y}-${m}-${d}`);
            const type = cols[1].innerText.trim();
            const time = timeStrToNum(cols[2].innerText);

            if (date >= weekStart) {
                if (type === "Kommen") {
                    startWoche.push(time);
                    if (date.getDate() === today.getDate())
                    {
                        startHeute.push(time);
                    }
                } else if (type === "Gehen") {
                    stopWoche.push(time);
                    if (date.getDate() === today.getDate())
                    {
                        stopHeute.push(time);
                    }
                }
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

        const startTimeToday = Math.min(...startHeute);
        const endeVollPause = startTimeToday + config.workingTime[dayIndex] + vollPausenZeit();

        const weekTarget = config.workingTime.reduce((a, b) => a + b, 0);
        const restWoche = weekTarget - arbeitWoche;

        let display = document.getElementById("timeLeft");
        if (!display) {
            const newDisplay = document.createElement("div");
            newDisplay.id = "timeLeft";
            newDisplay.style = "font-size:16px; font-family:Tahoma; margin-top:-15px;background:#00000088;";
            document.querySelector(".user-profile-text")?.append(newDisplay);
            display = newDisplay;
        }

        display.style.color = restHeute > 0 ? "lightgreen" : "red";
        display.title = "Zeigt verbleibende Arbeitszeit (mit aktueller oder voller Pause)";
        display.innerHTML = `
            Heute ${restHeute > 0 ? "verbleibend" : "drüber"}: <b>${decTimeToString(Math.abs(restHeute))}</b> bis: <b>${decTimeToString(endeVollPause)}</b> Uhr (inkl. Pausen). Woche: <b>${decTimeToString(arbeitWoche)}</b> / <b>${decTimeToString(weekTarget)}</b> h (${decTimeToString(restWoche)}h verbleibend)
        `;
    }

    function addSettingsButton() {
        const button = document.createElement("button");
        button.innerText = "⚙️";
        button.title = "Konfiguration öffnen";
        button.style = "position:fixed; bottom:15px; right:15px; font-size:18px; z-index:9999;";
        button.onclick = openSettingsDialog;
        document.body.appendChild(button);
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
    const initInterval = setInterval(() => {
        if (document.querySelector("#bookings tbody")) {
            clearInterval(initInterval);
            soLangeNoch();
            setInterval(soLangeNoch, 20000);
            addSettingsButton();
        }
    }, 1000);
})();
