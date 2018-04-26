'use strict';
var http = require('http');
var fs = require('fs');
var mime = require('mime-types');
var azure = require('azure-storage');
var uuid = require('uuid/v1');

var devCreds = azure.generateDevelopmentStorageCredentials();
var tableService = azure.createTableService(devCreds);


var port = process.env.PORT || 1337;

http.createServer(processRequest).listen(port);

function processRequest(req, res) {
    console.log(req.method + ': ' + req.url);
    switch (req.method) {
        case 'GET':
            processGet(req, res);
            break;
        case 'POST':
            processPost(req, res);
            break;
        default:
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad Request');
            break;
    }
}

function processGet(req, res) {
    var filePath = req.url;
    if (filePath.indexOf('/api/') === 0) {
        processApiGet(req, res);
        return;
    }
    if (filePath === '/') {
        filePath = '/bigapp.html';
    } 
    if (filePath[0] === '/') {
        filePath = filePath.substr(1);
    }
    
    console.log('serving: ' + filePath);
    
    var contentType = mime.contentType(filePath) || 'application/octet-stream';
    try {
        var contents = fs.readFileSync(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(contents);
    } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('' + err);
    }
}

function processPost(req, res) {
    var body = '';

    req.on('data', function (data) {
        body += data;

        if (body.length > 1e6) {
            request.connection.destroy();
        }
    });

    req.on('end', function () {
        var postData = JSON.parse(body);

        switch (req.url) {
            case '/api/user':
                createNewUser(postData, res);
                break;
            default:
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');
                break;
        }
    });
}

function processApiGet(req, res) {
    if (req.url.indexOf('/api/user/') === 0) {
        getUser(req.url.substr(10), res);
    } else if (req.url.indexOf('/api/importPlayers') === 0) {
        importPlayers(res);
    } else if (req.url.indexOf('/api/players') === 0) {
            showAllPlayers(res);
    } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
    }
}

function createNewUser(data, res) {
    var userId = uuid();
    ensureUserTable(tableName => {
        var entGen = azure.TableUtilities.entityGenerator;
        var entity = {
            PartitionKey: entGen.String(userId),
            RowKey: entGen.String(data.email.toLowerCase()),
            Password: entGen.String(data.password),
            Name: entGen.String(data.email.split('@')[0]),
            UserSince: entGen.DateTime(new Date()),
            //boolValueTrue: entGen.Boolean(true),
            //boolValueFalse: entGen.Boolean(false),
            //intValue: entGen.Int32(42),
            //dateValue: entGen.DateTime(new Date(Date.UTC(2011, 10, 25))),
            //complexDateValue: entGen.DateTime(new Date(Date.UTC(2013, 02, 16, 01, 46, 20)))
        };
        tableService.insertEntity(tableName, entity, function (error, result, response) {
            if (!error) {
                // result contains the ETag for the new entity
                entity['ETag'] = result;
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify({ userId: userId }));
            }
        });
    });
}

function ensureUserTable(callback) {
    tableService.createTableIfNotExists('users', function (error, result, response) {
        if (!error) {
            callback('users');
        }
    });
}

function getUser(userId, res) {
    ensureUserTable(tableName => {
        var query = new azure.TableQuery()
            .select(['RowKey', 'Name', 'UserSince'])
            .top(1)
            .where('PartitionKey eq ?', userId);
        tableService.queryEntities(tableName, query, null, function (error, result, response) {
            if (!error) {
                var entity = result.entries[0];
                var data = {email: entity.RowKey._, name: entity.Name._, since: entity.UserSince._};
                console.log('' + data);
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify(data));
            }
        });
    });
}

function importPlayers(res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    var contents = fs.readFileSync('playerData/RB 2018 List.csv', 'utf8');
    var lines = contents.split(/[\n\r]+/);
    var columns = lines[0].split(',');
    var allDigits = /^\d+$/;
    for (var i = 0; i < columns.length; i++) {
        if (allDigits.test(columns[i])) {
            columns[i] = '' + columns[i] + '-yard';
        }
    }
    var data = [];
    for (var i = 1; i < lines.length; i++) {
        var ind = lines[i].split(',');
        if (ind.length === columns.length) {
            var player = {};
            for (var j = 0; j < ind.length; j++) {
                if (columns[j] === '#' || columns[j] === 'ID') {
                    continue;
                }
                player[columns[j]] = ind[j];
            }
            data.push(player);
        }
    }

    ensurePlayersTable(tableName => {
        var pos = uniquePositions(data);
        var batches = [];

        for (var i = 0; i < pos.length; i++) {
            var posData = data.filter(a => a['Pos.'] === pos[i]);
            for (var j = 0; j < posData.length; j += 100) {
                var entGen = azure.TableUtilities.entityGenerator;
                var batch = new azure.TableBatch();
                for (var i = j; i < Math.min(posData.length, j + 100); i++) {
                    var player = posData[i];
                    var entity = {
                        PartitionKey: entGen.String(player['Pos.']),
                        RowKey: entGen.String(uuid()),
                        Name: entGen.String(player['Name']),
                        School: entGen.String(player['School']),
                        PlayerJSON: entGen.String(JSON.stringify(player))
                    };
                    batch.addOperation(azure.Constants.TableConstants.Operations.INSERT, entity);
                }
                batches.push(batch);
            }
        }
         executeBatches(batches, tableName, 0);
         res.end('' + data.length + ' players added');
     });

}

function ensurePlayersTable(callback) {
    tableService.createTableIfNotExists('players', function (error, result, response) {
        if (!error) {
            callback('players');
        }
    });
}

function executeBatches(batches, tableName, i) {
    tableService.executeBatch(tableName, batches[i], function (error, result, response) {
        if (!error) {
            if (i + 1 < batches.length) {
                executeBatches(batches, tableName, i + 1);
            }
        }
    });
}

function showAllPlayers(res) {
    ensurePlayersTable(tableName => {

        var players = [];
        function callback(error, result, response) {
            if (!error) {
                result.entries.forEach(function (x) { players.push(JSON.parse(x.PlayerJSON._)); });
                if (result.continuationToken) {
                    tableService.queryEntities(tableName, null, result.continuationToken, callback);
                } else {
                    res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                    res.end(JSON.stringify(players));
                }
            }
        }
        tableService.queryEntities(tableName, null, null, callback);
    });
}

function uniquePositions(arr) {
    var counts = {};
    for (var i = 0; i < arr.length; i++) {
        var key = arr[i]['Pos.'];

        if (counts[key]) {
            counts[key] += 1;
        } else {
            counts[key] = 1;
        }
    }
    var keys = Object.keys(counts);
    return keys;
}

