// ==UserScript==
// @name         my_spdata_timer
// @namespace    http://tampermonkey.net/
// @version      2025-07-11
// @description  try to take over the world!
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
        let startHours = starttime.substr(0, 2);
        let startMinutes = starttime.substr(3, 2);

        let startDate = new Date();
        startDate.setHours(startHours);
        startDate.setMinutes(startMinutes);
        startDate.setSeconds(0);

        let dow = startDate.getDay()-1;

        let endDate = new Date(startDate);
        let offset = (workingTime[dow]+break1+break2)*60;
        endDate.setMinutes(endDate.getMinutes() + offset);

        let timeLeft = (endDate - new Date())/60/60/1000;
        let negateTime = 1;
        if(timeLeft < 0){
            timeLeft = timeLeft*-1;
            negateTime = -1;
        }
        let hLeft = Math.floor(timeLeft);
        let mLeft = (60*(timeLeft-hLeft)).toFixed(0)
        mLeft = ("00000" + mLeft).slice(-2);
        hLeft = hLeft * negateTime;

        var divEle = document.getElementById("timeLeft");

        if(!divEle) {
            divEle = document.createElement("div");
            divEle.id = "timeLeft";
            divEle.style = "color: white; font-size:16px; font-family:Tahoma; padding-left:40px";
            divEle.classList.add("row");
            document.getElementById("timeterminalfront").querySelector(".col-8").appendChild(divEle);
        }
        divEle.innerHTML = "Anwesend UPDATE bis " + endDate.toLocaleTimeString() + " (" + hLeft + ":" + mLeft + "h verbleibend)";
    }
})();