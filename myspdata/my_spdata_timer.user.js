// ==UserScript==
// @name         my_spdata_timer
// @namespace    http://tampermonkey.net/
// @version      2025-07-16
// @description  How long do I have to stay
// @author       weaseldev
// @match        https://myspdata.duerkopp.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duerkopp.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var break1 = 0.25;
    var break2 = 0.5;
    var workingTime = [7.75, 7.75, 7.75, 6.75, 5]
    let wieLangeNochTimer = setTimeout(function nurNoch20Minuten() {
        try{
        soLangeNoch();
        } catch(err)
        {
        }
        wieLangeNochTimer = setTimeout(nurNoch20Minuten, 2000);
    }, 5000);

    function soLangeNoch() {
        let starttime = document.getElementsByClassName("terminalclock")[0].querySelector("li.list-group-item > p:nth-child(2)").innerText.substr(14,5);

        let startDate = new Date();
        startDate.setHours(starttime.substr(0, 2));
        startDate.setMinutes(starttime.substr(3, 2));
        startDate.setSeconds(0);

        let dow = startDate.getDay()-1;

        let endDate = new Date(startDate);
        let offset = (workingTime[dow]+break1+break2)*60;
        endDate.setMinutes(endDate.getMinutes() + offset);

        let timeLeft = (endDate - new Date())/60/60/1000;
        let negateTime = false;
        if(timeLeft < 0){
            timeLeft = -timeLeft;
            negateTime = true;
        }
        let hLeft = Math.floor(timeLeft);
        let mLeft = (60*(timeLeft-hLeft)).toFixed(0)
        mLeft = ("00000" + mLeft).slice(-2);

        var divEle = document.getElementById("timeLeft");

        if(!divEle) {
            divEle = document.createElement("div");
            divEle.id = "timeLeft";
            divEle.style = "color: white; font-size:16px; font-family:Tahoma; padding-left:40px";
            divEle.classList.add("row");
            document.getElementById("timeterminalfront").querySelector(".col-8").appendChild(divEle);
        }
        divEle.innerHTML = "Anwesend bis " + endDate.toLocaleTimeString() + " (" + hLeft + ":" + mLeft + "h " + (!negateTime ? "verbleibend)" : "drüber)");
    }
})();