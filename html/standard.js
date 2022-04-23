function Stats_Page_Init() {
    updateNavigation();
}

function updateNavigation() {
    fetch("/api/stats/navigation", getAuthHeader())
        .then(STANDARD_FETCH_RESPONSE_CHECKER)
        .then(json => {
            for (let i = 0; i < 5; i++) {
                let elt = document.getElementById('NAVIGATION_BUTTON_TOP' + (i + 1));
                if (!elt) continue;
                
                if (!json.users[i]) {
                    elt.href = "";
                    elt.childNodes[0].innerHTML = "TOP " + (i+1) + " USER";
                } else {
                    elt.href = ROOT + "Stats/Users/" + json.users[i].user_id;
                    elt.childNodes[0].innerHTML = json.users[i].user_name;
                }
            }

            if (!json.streams || json.streams.length === 0) {
                document.getElementById('NAVIGATION_LAST_STREAM').href = "";
            } else {
                document.getElementById('NAVIGATION_LAST_STREAM').href = ROOT + "Stats/Streams/" + json.streams[0].stream_id;
            }
        })
        .catch(err => {
            console.log(err);
            OUTPUT_showError(err.message);
        });
}