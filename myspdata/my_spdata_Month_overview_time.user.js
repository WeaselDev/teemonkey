// ==UserScript==
// @name         my_spdata_Month_overview_time
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Zeigt Werte auf der Monatssalden-Seite als Uhrzeitformat (hh:mm) an – Dezimal werte bleiben erhalten - sichtbar durch Mouseover-Effekt.
// @author       LuWa-eng
// @match        https://myspdata.duerkopp.com/
// @match        https://myspdata.duerkopp.com/#/Overview/Monatssalden/*
// @match        https://myspdata.duerkopp.com/#/Overview/Zeitkonto/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duerkopp.com
// @grant        none
// ==/UserScript==




(function() {
    'use strict';

    function decimalToTime(decimal) {
        const sign = decimal < 0 ? "-" : "";
        const abs = Math.abs(decimal);
        const hours = Math.floor(abs);
        const minutes = Math.round((abs - hours) * 60);
        return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
    }

      function convertGLZValues() {
        const elements = document.querySelectorAll('td.dt-type-numeric');

        elements.forEach(el => {
            const text = el.textContent.trim();

            // Erkenne Zahlen mit Komma und optional "h"
            const match = text.match(/^(-?\d{1,3},\d{1,2})(h)?$/);
            if (match && !el.dataset.converted) {
                const decimal = parseFloat(match[1].replace(",", "."));
                const time = decimalToTime(decimal);

                // Erstelle kleines graues <span> für die Uhrzeit
                el.title = el.textContent;
                el.textContent = `(${time})`;
                el.dataset.converted = "true";
            }
        });
    }

    setInterval(convertGLZValues, 2000);
})();
