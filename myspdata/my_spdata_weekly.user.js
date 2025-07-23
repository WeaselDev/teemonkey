// ==UserScript==
// @name         my_spdata_weekly
// @namespace    http://tampermonkey.net/
// @version      2025-07-23
// @description  Zeigt verbleibende Arbeitszeit für heute + Wochensumme – mit konfigurierbarer Wochenzeit pro Tag (Mo–Fr).
// @author       weaseldev
// @match        https://myspdata.duerkopp.com/
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Default-Arbeitszeiten
    const defaultWorkingTime = [7.75, 7.75, 7.75, 6.75, 5];

    // Speicher-/Ladefunktionen
    function getWorkingTimes() {
        const raw = localStorage.getItem("myspdata_working_time");
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length === 5) return parsed;
            } catch (e) {}
        }
        return defaultWorkingTime;
    }

    function saveWorkingTimes(times) {
        localStorage.setItem("myspdata_working_time", JSON.stringify(times));
    }

    const workingTime = getWorkingTimes();

    // === HILFSFUNKTIONEN ===
    function timeStrToNum(timeStr) {
        const [h, m] = timeStr.split(":");
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
            if (s < 9 && e > 9.25) pause += 0.25;
            else if (s < 9 && e > 9 && e < 9.25) pause += (e - 9);
            else if (e > 9.25 && s > 9 && s < 9.25) pause += (9.25 - s);

            if (s < 12.75 && e > 13.25) pause += 0.5;
            else if (s < 12.75 && e > 12.75 && e < 13.25) pause += (e - 12.75);
            else if (e > 13.25 && s > 12.75 && s < 13.25) pause += (13.25 - s);
        }
        return pause;
    }

    function soLangeNoch() {
        const today = new Date();
        const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - todayIndex);
        weekStart.setHours(0, 0, 0, 0);

        const startWoche = [], stopWoche = [], startHeute = [], stopHeute = [];

        const bookingTable = document.querySelector("#bookings");
        if (!bookingTable) return;

        const rows = bookingTable.querySelectorAll("tr");
        for (let i = rows.length - 1; i > 0; i--) {
            const cols = rows[i].children;
            const [day, month, year] = cols[0].innerText.split(".");
            const date = new Date(`${year}-${month}-${day}`);
            const type = cols[1].innerText.trim();
            const time = timeStrToNum(cols[2].innerText);

            if (date >= weekStart) {
                if (type === "Kommen") {
                    startWoche.push(time);
                    if (date.getDate() === today.getDate()) startHeute.push(time);
                } else if (type === "Gehen") {
                    stopWoche.push(time);
                    if (date.getDate() === today.getDate()) stopHeute.push(time);
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
        const restHeute = workingTime[todayIndex] - arbeitHeute;

        // Anzeige
        let display = document.getElementById("timeLeft");
        if (!display) {
            display = document.createElement("div");
            display.id = "timeLeft";
            display.style = "font-size:16px; font-family:Tahoma; padding-left:20px; margin-top:-15px";
            document.querySelector(".user-profile-text")?.append(display);
        }

        display.style.color = restHeute > 0 ? "yellow" : "red";
        display.textContent = `Heute ${restHeute > 0 ? "verbleibend" : "drüber"}: ${decTimeToString(Math.abs(restHeute))} – bis ca. ${decTimeToString(nowTime + restHeute)} | Woche: ${decTimeToString(arbeitWoche)}h`;
    }

    // === KONFIGURATIONS-DIALOG ===
    function createConfigUI() {
        const btn = document.createElement("button");
        btn.textContent = "⚙️";
        btn.style = "position:fixed; top:10px; right:10px; z-index:9999; background:#444; color:white; border:none; padding:5px; border-radius:5px; cursor:pointer";
        document.body.appendChild(btn);

        btn.onclick = () => {
            const wrapper = document.createElement("div");
            wrapper.style = "position:fixed; top:50px; right:20px; background:white; padding:15px; border:1px solid #ccc; border-radius:8px; z-index:9999; font-family:sans-serif";
            wrapper.innerHTML = `
                <strong>Arbeitszeit pro Tag (h):</strong><br>
                <label>Mo: <input id="wt0" value="${workingTime[0]}" size="4"></label><br>
                <label>Di: <input id="wt1" value="${workingTime[1]}" size="4"></label><br>
                <label>Mi: <input id="wt2" value="${workingTime[2]}" size="4"></label><br>
                <label>Do: <input id="wt3" value="${workingTime[3]}" size="4"></label><br>
                <label>Fr: <input id="wt4" value="${workingTime[4]}" size="4"></label><br><br>
                <button id="saveBtn">Speichern</button>
                <button id="closeBtn">Schließen</button>
            `;
            document.body.appendChild(wrapper);

            document.getElementById("saveBtn").onclick = () => {
                const newTimes = [];
                for (let i = 0; i < 5; i++) {
                    newTimes.push(parseFloat(document.getElementById(`wt${i}`).value) || 0);
                }
                saveWorkingTimes(newTimes);
                alert("Gespeichert! Seite wird neu geladen.");
                location.reload();
            };

            document.getElementById("closeBtn").onclick = () => wrapper.remove();
        };
    }

    // === Start alles ===
    createConfigUI();

    setTimeout(function loop() {
        try { soLangeNoch(); } catch (e) { console.warn(e); }
        setTimeout(loop, 10000);
    }, 2000);

})();
