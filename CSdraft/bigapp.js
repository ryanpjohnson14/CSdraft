function showSection(sectionId){
    var reset = document.querySelectorAll('#content section');
    for (var i = 0; i < reset.length; i++){
        reset[i].style.removeProperty('display');
    }
    var section = document.getElementById(sectionId);
    section.style.display = 'block';

    var onShow = section.getAttribute('data-onShow');

    if (onShow && typeof window[onShow] === 'function') {
        window[onShow]();
    }
}

function createUser(){
    var userEmail = document.querySelector('#createUserForm input[name="userEmail"]').value;
    var userPassword = document.querySelector('#createUserForm input[name="userPassword"]').value;
    var passwordConfirm = document.querySelector('#createUserForm input[name="userPasswordConfirm"]').value;

    if (userPassword !== passwordConfirm){
        document.getElementById('passwordMismatch').removeAttribute('hidden');
        return;
    }
    document.getElementById('passwordMismatch').setAttribute('hidden', '');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/user', false);
    xhr.send(JSON.stringify({ email: userEmail, password: userPassword }));
    if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);

        var expiration = new Date();
        expiration.setDate(expiration.getDate() + 365);
        document.cookie = 'userId=' + data.userId + ';path=/;expires=' + expiration.toUTCString();
        showSection('home');
    } else {
        alert('Account Creation Failed');
    }
}

function getUserId() {
    var cookie = document.cookie;
    if (cookie) {
        var rx = /\buserId=([0-9a-f\-]+)/i;
        var match = cookie.match(rx);
        if (match) {
            return match[1];
        }
    }
    return null;
}

function showingProfile() {
    var userId = getUserId();
    if (userId) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/user/' + userId, false);
        xhr.send();
        if (xhr.status === 200) {
            var data = JSON.parse(xhr.responseText);
            document.querySelector("#profile td.email").textContent = data.email;
            document.querySelector("#profile td.name").textContent = data.name;
            document.querySelector("#profile td.since").textContent = new Date(data.since).toLocaleString();
        }

    }
}

var players = null;

function showingPlayers() {
    var div = document.getElementById('playersTable');
    div.removeAttribute('hidden');
    var playersDetail = document.getElementById("playersDetail");
    playersDetail.setAttribute('hidden', '');
    selectChange();

    if (players) {
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/players', false);
    xhr.send();
    if (xhr.status === 200) {
        players = JSON.parse(xhr.responseText);
        if (players.length === 0) {
            return;
        }
        var keys = Object.keys(players[0].data);
        var table = document.createElement('table');
        var tr = document.createElement('tr');
        table.appendChild(tr);
        for (var k = 0; k < keys.length; k++) {
            if (keys[k] === 'ID') {
                continue;
            }
            let td = document.createElement('th');
            td.textContent = keys[k];
            tr.appendChild(td);
        }
        for (var i = 0; i < players.length; i++) {
            tr = document.createElement('tr');
            tr.setAttribute('data-name', players[i].data.Name);
            tr.setAttribute('data-school', players[i].data.School);
            tr.setAttribute('data-position', players[i].data['Pos.']);
            tr.addEventListener('click', function (ev) { displayPlayer(ev.currentTarget.getAttribute('data-name')); });
            table.appendChild(tr);
            for (var j = 0; j < keys.length; j++) {
                if (keys[j] === 'ID') {
                    continue;
                }
                let td = document.createElement('td');
                td.textContent = players[i].data[keys[j]];
                tr.appendChild(td);
            }
        }
        
        div.textContent = '';
        div.appendChild(table);

        populateDatalist('players-Datalist', players.map(function (x) { return x.data.Name; }));
        populateDatalist('schools-Datalist', players.map(function (x) { return x.data.School; }));
        populateDatalist('positions-Datalist', players.map(function (x) { return x.data['Pos.']; }));

        document.getElementById('schools-Datalist').addEventListener('change', selectChange);
        document.getElementById('players-Datalist').addEventListener('change', selectChange);
        document.getElementById('positions-Datalist').addEventListener('change', selectChange);
    }
}

function selectChange() {
    var style = document.getElementById('playersFilter');
    var schoolSelect = document.getElementById('schools-Datalist');
    var playerSelect = document.getElementById('players-Datalist');
    var positionSelect = document.getElementById('positions-Datalist');
    if (playerSelect.value.trim()) {
        schoolSelect.selectedIndex = 0;
        positionSelect.selectedIndex = 0;
        style.textContent = `#playersTable tr:not([data-name='${playerSelect.value}']):not(:first-child) {display: none;}`;
    } else if (schoolSelect.value.trim() || positionSelect.value.trim()) {
        playerSelect.selectedIndex = 0;
        if (schoolSelect.value.trim() && positionSelect.value.trim()) {
            style.textContent = `#playersTable tr {display: none} \n #playersTable tr[data-school='${schoolSelect.value}'][data-position='${positionSelect.value}'] {display: table-row;}`;
        } else if (schoolSelect.value.trim()) {
            style.textContent = `#playersTable tr:not([data-school='${schoolSelect.value}']):not(:first-child) {display: none;}`;
        } else {
            style.textContent = `#playersTable tr:not([data-position='${positionSelect.value}']):not(:first-child) {display: none;}`;
        }
    } else {
        style.textContent = '';
    }
}

function populateDatalist(id, values) {
    var dataList = document.getElementById(id);
    dataList.innerHTML = '<option selected>&nbsp;</option>';
    var uniques = {};

    for (var i = 0; i < values.length; i++) {
        var key = values[i];

        if (uniques[key]) {
            uniques[key] += 1;
        } else {
            uniques[key] = 1;
        }
    }

    values = Object.keys(uniques);
    values.sort();

    for (var i = 0; i < values.length; i++) {
        let option = document.createElement('option');
        option.setAttribute('value', values[i]);
        option.textContent = values[i];
        dataList.appendChild(option);
    }
}

function displayPlayer(name) {
    var playersTable = document.getElementById("playersTable");
    var playersDetail = document.getElementById("playersDetail");
    var playerRating = document.getElementById("ratingRange");
    var playersDetailData = document.getElementById('playersDetailData');
    playersDetail.querySelector('.status').textContent = '';

    var nameMatch = players.filter(a => a.data.Name === name);
    if (nameMatch.length === 0) {
        playersDetailData.textContent = `${name} Not Found`;
        return;
    } else if (nameMatch.length > 1) {
        playersDetailData.textContent = `${nameMatch.length} ${name} Found`;
        return;
    }
    var player = nameMatch[0];
    var keys = Object.keys(player.data);

    var t = document.createElement('table');
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] === 'ID') {
            continue;
        }
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.textContent = keys[i];
        tr.appendChild(td);
        td = document.createElement('td');
        td.textContent = player.data[keys[i]];
        tr.appendChild(td);
        t.appendChild(tr);
    }
    playersDetailData.textContent = '';
    playersDetailData.appendChild(t);
    playersTable.setAttribute('hidden', '');
    playersDetail.removeAttribute('hidden');
    document.getElementById("playerRkey").value = player.rkey;
    document.getElementById("playerPkey").value = player.pkey;
    document.getElementById("ratingRange").value = '';
    getRating(getUserId(), player.rkey, rating => { document.getElementById("ratingRange").value = rating.toString(); });
}

function saveRating() {
    var status = document.querySelector('#playerRating .status');
    var rating = parseInt(document.getElementById("ratingRange").value);
    var rkey = document.getElementById("playerRkey").value;
    var pkey = getUserId();
    if (!pkey) {
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/rating/' + pkey + '/' + rkey, false);
    xhr.send(JSON.stringify({ rating: rating }));
    if (xhr.status === 200) {
        status.textContent = 'Rating Saved';
    } else {
        alert('Rating Submission Failed');
    }
}

function getRating(pkey, rkey, callback) {
    if (!pkey) {
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/rating/' + pkey + '/' + rkey, false);
    xhr.send();
    if (xhr.status === 200) {
        var response = JSON.parse(xhr.responseText);
        callback(response.rating);
    }
}

function showingHome() {
    var ratedPlayers = document.getElementById('ratedPlayers');
    ratedPlayers.textContent = '';

    var userId = getUserId();
    if (!userId) {
        ratedPlayers.textContent = "Please Sign in to View Rated Players";
        return;
    }
    if (!players) {
        ratedPlayers.textContent = 'Please view Players tab first';
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/rated/' + userId, false);
    xhr.send();
    if (xhr.status === 200) {
        var rpArr = JSON.parse(xhr.responseText);

        for (var i = 0; i < rpArr.length; i++) {
            var playerMatch = players.filter(a => a.rkey === rpArr[i].id);
            if (playerMatch.length === 1) {
                rpArr[i].Name = playerMatch[0].data.Name;
                rpArr[i].Position = playerMatch[0].data['Pos.'];
            }
        }
        var positions = {};
        for (var k = 0; k < rpArr.length; k++) {
            var key = rpArr[k].Position;
            if (key) {
                positions[key] = key;
            }
        }
        var posKeys = Object.keys(positions);
        posKeys.sort();

        var t = document.createElement('table');
        var tr = document.createElement('tr');

        for (var j = 0; j < posKeys.length; j++) {
            var th = document.createElement('th');
            th.textContent = posKeys[j];
            tr.appendChild(th);
        }
        t.appendChild(tr);

        for (var m = 99; m >= 30; m--) {
            tr = document.createElement('tr');
            for (var n = 0; n < posKeys.length; n++) {
                var p = rpArr.filter(a => a.rating === m && a.Position === posKeys[n]);
                var pdisplay = p.map(b => `${b.Name}, ${b.rating}`).join('<br>');
                var td = document.createElement('td');
                td.innerHTML = pdisplay || '';
                tr.appendChild(td);
            }
            t.appendChild(tr);
        }
        ratedPlayers.appendChild(t);
    }
}