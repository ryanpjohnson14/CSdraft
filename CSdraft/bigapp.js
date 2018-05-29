var players = null;
var signedInUser = null;
var tips = {
    SS: 'Short Shuttle (seconds)',
    TC: 'Three-Cone (seconds)',
    BP: 'Bench Press (reps of 225 lbs)',
    VJ: 'Vertical Jump (in)',
    BJ: 'Broad Jump (ft)'
};

// original cookie: 77fdb0e0-458d-11e8-a56c-27039c7e9df9

function init() {
    signedInUser = null;  
    var userId = getUserId();
    if (userId) {
        var xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                signedInUser = JSON.parse(xhr.responseText);          
                signInStatus();
            } else {
                signInStatus();
            }
        });
        xhr.open('GET', '/api/user/' + userId, true);
        xhr.send();
    } else {
        signInStatus();
    }
}
document.addEventListener('DOMContentLoaded', init);

function signInStatus() {
    var signedInElements = document.querySelectorAll('.signedIn');
    
    for (var i = 0; i < signedInElements.length; i++) {
        if (signedInUser) {
            signedInElements[i].removeAttribute('hidden');
        } else {
            signedInElements[i].setAttribute('hidden', '');
        }
    }
    var notSignedInElements = document.querySelectorAll('.notSignedIn');

    for (var i = 0; i < notSignedInElements.length; i++) {
        if (!signedInUser) {
            notSignedInElements[i].removeAttribute('hidden');
        } else {
            notSignedInElements[i].setAttribute('hidden', '');
        }
    }
    if (signedInUser) {
        document.getElementById('signedInAs').textContent = `Signed in as ${signedInUser.name}`;
        loadPlayers();
    } else {
        document.getElementById('signedInAs').textContent = 'Please Sign In';
    }
}

function loadPlayers() {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            players = JSON.parse(xhr.responseText);
            showSection('home');
        }
    });
    xhr.open('GET', '/api/players', true);
    xhr.send();
}

function showSection(sectionId) {
    var section = unhideSection(sectionId);
    var onShow = section.getAttribute('data-onShow');

    if (onShow && typeof window[onShow] === 'function') {
        window[onShow]();
    }
}

function unhideSection(sectionId) {
    var reset = document.querySelectorAll('#content section');
    for (var i = 0; i < reset.length; i++) {
        reset[i].style.removeProperty('display');
    }
    var section = document.getElementById(sectionId);
    section.style.display = 'block';
    return section;
}

function createUser() {
    var userEmail = document.querySelector('#createUserForm input[name="userEmail"]').value;
    var userPassword = document.querySelector('#createUserForm input[name="userPassword"]').value;
    var passwordConfirm = document.querySelector('#createUserForm input[name="userPasswordConfirm"]').value;

    if (userPassword !== passwordConfirm) {
        document.getElementById('passwordMismatch').removeAttribute('hidden');
        return;
    }
    document.getElementById('passwordMismatch').setAttribute('hidden', '');

    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            signedInUser = JSON.parse(xhr.responseText);
            signInStatus();
            var expiration = new Date();
            expiration.setDate(expiration.getDate() + 365);
            document.cookie = 'userId=' + signedInUser.userId + ';path=/;expires=' + expiration.toUTCString();
        } else {
            alert('Account Creation Failed');
        }
    });
    xhr.open('POST', '/api/user', true);
    xhr.send(JSON.stringify({ email: userEmail, password: userPassword }));
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
    if (signedInUser) {
        document.querySelector("#profile td.email").textContent = signedInUser.email;
        document.querySelector("#profile td.name").textContent = signedInUser.name;
        document.querySelector("#profile td.since").textContent = new Date(signedInUser.since).toLocaleString();
    }
}

function showingPlayers() {
    var div = document.getElementById('playersTable');
    div.removeAttribute('hidden');
    var playersDetail = document.getElementById("playersDetail");
    playersDetail.setAttribute('hidden', '');
    selectChange();

    if (!players || players.length === 0) {
        return;
    }

    var keys = Object.keys(players[0].data);
    var table = document.createElement('table');
    var tr = document.createElement('tr');
    table.appendChild(tr);
    for (var k = 0; k < keys.length; k++) {
        if (keys[k] === 'ID' || keys[k].indexOf('#') !== -1) {
            continue;
        }
        let td = document.createElement('th');
        if (tips[keys[k]]) {
            td.setAttribute('title', tips[keys[k]]);
        }
        td.textContent = keys[k];
        tr.appendChild(td);
    }
    for (var i = 0; i < players.length; i++) {
        tr = document.createElement('tr');
        tr.setAttribute('data-name', players[i].data.Name);
        tr.setAttribute('data-school', players[i].data.School);
        tr.setAttribute('data-position', players[i].data['Pos.']);
        tr.setAttribute('onclick', `displayPlayer('${players[i].data.Name}')`);
        table.appendChild(tr);
        for (var j = 0; j < keys.length; j++) {
            if (keys[j] === 'ID' || keys[j].indexOf('#') !== -1) {
                continue;
            }
            let td = document.createElement('td');
            var x = players[i].data[keys[j]];
            td.textContent = x;
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
    unhideSection('players');
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
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            status.textContent = 'Rating Saved';
        } else {
            alert('Rating Submission Failed');
        }
    });
    xhr.open('POST', '/api/rating/' + pkey + '/' + rkey, true);
    xhr.send(JSON.stringify({ rating: rating }));
   
}

function getRating(pkey, rkey, callback) {
    if (!pkey) {
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            callback(response.rating);
        }
    });
    xhr.open('GET', '/api/rating/' + pkey + '/' + rkey, true);
    xhr.send();
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
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            var rpArr = JSON.parse(xhr.responseText);

            for (var i = 0; i < rpArr.length; i++) {
                var playerMatch = players.filter(a => a.rkey === rpArr[i].id);
                if (playerMatch.length === 1) {
                    rpArr[i].Name = playerMatch[0].data.Name;
                    rpArr[i].Position = playerMatch[0].data['Pos.'];
                }
            }
            var switchValue = document.querySelector('input[name="homeShow"]:checked').value;
            if (switchValue === 'grid') {
                showBoard(rpArr, ratedPlayers);
            } else {
                showStack(rpArr, ratedPlayers);
            }
        }
    });
    xhr.open('GET', '/api/rated/' + userId, true);
    xhr.send();
}

function showStack(rpArr, ratedPlayers) {
    rpArr.sort(function (a, b) { return b.rating - a.rating; });
    var container = document.createElement('div');
    container.className = 'container';
    for (var i = 0; i < rpArr.length; i += 32) {
        var column = document.createElement('div');
        column.className = 'column';
        for (var j = i; j < Math.min(rpArr.length, i + 32); j++) {
            var item = document.createElement('div');
            item.className = 'item';
            item.textContent = `${j + 1}: ${rpArr[j].Position} ${rpArr[j].Name}, ${rpArr[j].rating}`;
            item.setAttribute('onclick', `displayPlayer('${rpArr[j].Name}')`);
            column.appendChild(item);
        }
        container.appendChild(column);
    }
    ratedPlayers.appendChild(container);
}

function showBoard(rpArr, ratedPlayers) {
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
            var td = document.createElement('td');         
            for (var q = 0; q < p.length; q++) {
                var div = document.createElement('div'); 
                div.textContent = `${p[q].Name}, ${p[q].rating}`;
                div.setAttribute('onclick', `displayPlayer('${p[q].Name}')`);
                td.appendChild(div);
            }
            tr.appendChild(td);
        }
        t.appendChild(tr);
    }
    ratedPlayers.appendChild(t);
}

function signIn() {
    var userEmail = document.querySelector('#signInForm input[name="userEmail"]').value;
    var userPassword = document.querySelector('#signInForm input[name="userPassword"]').value;
    var passwordConfirm = document.querySelector('#signInForm input[name="userPasswordConfirm"]').value;

    if (userPassword !== passwordConfirm) {
        document.getElementById('signInPasswordMismatch').removeAttribute('hidden');
        return;
    }
    document.getElementById('signInPasswordMismatch').setAttribute('hidden', '');

    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            signedInUser = JSON.parse(xhr.responseText);
            signInStatus();
            var expiration = new Date();
            expiration.setDate(expiration.getDate() + 365);
            document.cookie = 'userId=' + signedInUser.userId + ';path=/;expires=' + expiration.toUTCString();
        } else {
            alert('sign in failed');
        }
    });
    xhr.open('POST', '/api/signIn', true);
    xhr.send(JSON.stringify({ email: userEmail, password: userPassword }));
}

function doSignOut() {
    document.cookie = 'userId=' + '' + ';path=/;expires=' + new Date().toUTCString();
    players = null;
    signedInUser = null;
    signInStatus();
    showSection('signIn');
}