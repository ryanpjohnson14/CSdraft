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

function showingProfile() {
    var cookie = document.cookie;
    if (cookie) {
        var rx = /\buserId=([0-9a-f\-]+)/i;
        var match = cookie.match(rx);
        if (match) {
            var userId = match[1];
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
}

var players = null;

function showingPlayers() {
    var div = document.getElementById('playersTable');
    div.removeAttribute('hidden');
    var playersDetail = document.getElementById("playersDetail");
    playersDetail.setAttribute('hidden', '');
    var style = document.getElementById('playersFilter');
    style.textContent = '';

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
        var keys = Object.keys(players[0]);
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
            tr.setAttribute('data-name', players[i].Name);
            tr.setAttribute('data-school', players[i].School);
            tr.setAttribute('data-position', players[i]['Pos.']);
            tr.addEventListener('click', function (ev) { displayPlayer(ev.currentTarget.getAttribute('data-name')); });
            table.appendChild(tr);
            for (var j = 0; j < keys.length; j++) {
                if (keys[j] === 'ID') {
                    continue;
                }
                let td = document.createElement('td');
                td.textContent = players[i][keys[j]];
                tr.appendChild(td);
            }
        }
        
        div.textContent = '';
        div.appendChild(table);

        populateDatalist('players-Datalist', players.map(function (x) { return x.Name; }));
        populateDatalist('schools-Datalist', players.map(function (x) { return x.School; }));
        populateDatalist('positions-Datalist', players.map(function (x) { return x['Pos.']; }));

        document.getElementById('schools-Datalist').addEventListener('change', selectChange);
        document.getElementById('players-Datalist').addEventListener('change', selectChange);
        document.getElementById('positions-Datalist').addEventListener('change', selectChange);
    }
}

function selectChange(ev) {
    var style = document.getElementById('playersFilter');
    if (ev.target.value) {
        style.textContent = `#playersTable tr:not([${ev.target.getAttribute('data-attribute')}='${ev.target.value}']):not(:first-child) {display: none;}`;
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
    var nameMatch = players.filter(a => a.Name === name);
    if (nameMatch.length === 0) {
        playersDetail.textContent = `${name} Not Found`;
    } else if (nameMatch.length > 1) {
        playersDetail.textContent = `${nameMatch.length} ${name} Found`;
    }
    var player = nameMatch[0];
    var keys = Object.keys(player);

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
        td.textContent = player[keys[i]];
        tr.appendChild(td);
        t.appendChild(tr);
    }
    playersDetail.textContent = '';
    playersDetail.appendChild(t);
    playersTable.setAttribute('hidden', '');
    playersDetail.removeAttribute('hidden');
  
}