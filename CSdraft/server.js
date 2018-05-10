'use strict';
var http = require('http');
var fs = require('fs');
var mime = require('mime-types');
var azure = require('azure-storage');
var uuid = require('uuid/v1');

//var devCreds = azure.generateDevelopmentStorageCredentials();
//var tableService = azure.createTableService(devCreds);
var tableService = azure.createTableService("DefaultEndpointsProtocol=https;AccountName=csdraftdb;AccountKey=mXn9BNopoOYN/aavwG5dmH5Qh4pSyJZEIyFwQzLSUkyhdfXdzmIV2pa7M4I6ky7joFp7OggVj7iYvvlfzvmN+g==;EndpointSuffix=core.windows.net");

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
            req.connection.destroy();
        }
    });

    req.on('end', function () {
        var postData = JSON.parse(body);

        if (req.url === '/api/user') {
            createNewUser(postData, res);
        } else if (req.url === '/api/signIn') {
            signIn(postData, res);
        } else if (req.url.indexOf('/api/rating/') === 0) {
            var parts = req.url.split('/');
            saveRating(parts[3], parts[4], postData.rating, res);
        } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');             
        }
    });
}

function processApiGet(req, res) {
    if (req.url.indexOf('/api/user/') === 0) {
        getUser(req.url.substr(10), res);
    } else if (req.url.indexOf('/api/importPlayers') === 0) {
        importPlayers(res);
    } else if (req.url.indexOf('/api/players') === 0) {
            getPlayers(res);
    } else if (req.url.indexOf('/api/rating/') === 0) {
        var parts = req.url.split('/');
        getRating(parts[3], parts[4], res);
    } else if (req.url.indexOf('/api/rated/') === 0) {
        var parts = req.url.split('/');
        getRated(parts[3], res);
    }else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
    }
}

function createNewUser(postData, res) {
    var userId = uuid();
    ensureUserTable(tableName => {
        var entGen = azure.TableUtilities.entityGenerator;
        var entity = {
            PartitionKey: entGen.String(userId),
            RowKey: entGen.String(postData.email.toLowerCase()),
            Password: entGen.String(postData.password),
            Name: entGen.String(postData.email.split('@')[0]),
            UserSince: entGen.DateTime(new Date()),
            //boolValueTrue: entGen.Boolean(true),
            //boolValueFalse: entGen.Boolean(false),
            //intValue: entGen.Int32(42),
            //dateValue: entGen.DateTime(new Date(Date.UTC(2011, 10, 25))),
            //complexDateValue: entGen.DateTime(new Date(Date.UTC(2013, 02, 16, 01, 46, 20)))
        };
        tableService.insertEntity(tableName, entity, function (error, result, response) {
            if (!error) {            
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                var data = { email: entity.RowKey._, name: entity.Name._, since: entity.UserSince._, userId: entity.PartitionKey._ };
                res.end(JSON.stringify(data));
            } else {
                res.writeHead(response.statusCode);
                res.end();
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

function ensureRatingTable(callback) {
    tableService.createTableIfNotExists('ratings', function (error, result, response) {
        if (!error) {
            callback('ratings');
        }
    });
}

function signIn(postData, res) {
    ensureUserTable(tableName => {
        var query = new azure.TableQuery()
            .top(1)
            .where('RowKey eq ?', postData.email);
        tableService.queryEntities(tableName, query, null, function (error, result, response) {
            if (!error) {
                if (result.entries.length !== 1) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                var entity = result.entries[0];
                if (entity.Password._ !== postData.password) {
                    res.writeHead(401);
                    res.end();
                    return;
                }
                var data = { email: entity.RowKey._, name: entity.Name._, since: entity.UserSince._, userId: entity.PartitionKey._ };
                console.log('' + data);
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify(data));
            } else {
                res.writeHead(response.statusCode);
                res.end();
            }
        });
    });
}

function getUser(userId, res) {
    ensureUserTable(tableName => {
        var query = new azure.TableQuery()
            .top(1)
            .where('PartitionKey eq ?', userId);
        tableService.queryEntities(tableName, query, null, function (error, result, response) {
            if (!error) {
                if (result.entries.length !== 1) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                var entity = result.entries[0];
                var data = {email: entity.RowKey._, name: entity.Name._, since: entity.UserSince._, userId: entity.PartitionKey._};
                console.log('' + data);
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify(data));
            } else {
                res.writeHead(response.statusCode);
                res.end();
            }     
        });
    });
}

function importPlayers(res) {
    fs.readdir('playerData', function (err, items) {
        var allDigits = /^\d+$/;
        var data = [];
        for (var k = 0; k < items.length; k++) {
            var contents = fs.readFileSync(`playerData/${items[k]}`, 'utf8');
            var lines = contents.split(/[\n\r]+/);
            var columns = lines[0].split(',');            
            for (var m = 0; m < columns.length; m++) {
                if (allDigits.test(columns[m])) {
                    columns[m] = '' + columns[m] + '-yard';
                }
            }            
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
        }
        addPlayersToDatabase(data, res);
    });
}

function addPlayersToDatabase(data, res) {

            ensurePlayersTable(tableName => {
                var batches = [];
                var entGen = azure.TableUtilities.entityGenerator;              
                for (var j = 0; j < data.length; j += 100) {               
                    var batch = new azure.TableBatch();
                    for (var i = j; i < Math.min(data.length, j + 100); i++) {
                        var player = data[i];
                        var entity = {
                            PartitionKey: entGen.String('player'),
                            RowKey: entGen.String(uuid()),
                            Name: entGen.String(player['Name']),
                            School: entGen.String(player['School']),
                            PlayerJSON: entGen.String(JSON.stringify(player))
                        };
                        batch.addOperation(azure.Constants.TableConstants.Operations.INSERT, entity);
                    }
                    batches.push(batch);
                }           
                executeBatches(batches, tableName, 0, function (e, r) {
                    if (e) {
                        res.writeHead(r.statusCode, 'Execute Batches Failed');
                        res.end('Execute Batches Failed');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('' + data.length + ' players added');
                    }
                });               
            });

}

function ensurePlayersTable(callback) {
    tableService.createTableIfNotExists('players', function (error, result, response) {
        if (!error) {
            callback('players');
        }
    });
}

function executeBatches(batches, tableName, i, callback) {
    tableService.executeBatch(tableName, batches[i], function (error, result, response) {
        if (!error) {
            if (i + 1 < batches.length) {
                executeBatches(batches, tableName, i + 1, callback);
            } else {
                callback(null, null);
            }
        } else {
            callback(error, response);
        }
    });
}

function getPlayers(res) {
    ensurePlayersTable(tableName => {
        var players = [];
        function callback(error, result, response) {
            if (!error) {
                result.entries.forEach(function (x) {
                    var pd = {
                        pkey: x.PartitionKey._,
                        rkey: x.RowKey._,
                        data: JSON.parse(x.PlayerJSON._)
                    };
                    players.push(pd);
                });
                if (result.continuationToken) {
                    tableService.queryEntities(tableName, null, result.continuationToken, callback);
                } else {
                    res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                    res.end(JSON.stringify(players));
                }
            } else {
                res.writeHead(response.statusCode);
                res.end();
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

function saveRating(pkey, rkey, rating, res) {
    ensureRatingTable(tableName => {
        var entGen = azure.TableUtilities.entityGenerator;
        var entity = {
            PartitionKey: entGen.String(pkey),
            RowKey: entGen.String(rkey),
            Rating: entGen.Int32(rating),
        };
        tableService.insertOrReplaceEntity(tableName, entity, function (error, result, response) {
            if (!error) {
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify({ status: "Ok" }));
            } else {
                res.writeHead(response.statusCode);
                res.end();
            }           
        });
    });
}

function getRating(pkey, rkey, res) {
    ensureRatingTable(tableName => {
        tableService.retrieveEntity(tableName, pkey, rkey, function (error, entity, response) {
            if (!error) {
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify({ rating: entity.Rating._ }));
            } else {
                res.writeHead(response.statusCode);
                res.end();
            }     
        });
    });
}

function getRated(userId, res) {
    ensureRatingTable(tableName => {
        var query = new azure.TableQuery().where('PartitionKey eq ?', userId);
        tableService.queryEntities(tableName, query, null, function (error, result, response) {
            if (!error) {
                if (result.entries.length === 0) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                var ratedPlayers = [];
                for (var i = 0; i < result.entries.length; i++) {
                    var entity = result.entries[i];
                    ratedPlayers.push({ id: entity.RowKey._, rating: entity.Rating._ })
                }
       
                res.writeHead(200, { 'Content-Type': mime.contentType('json') });
                res.end(JSON.stringify(ratedPlayers));
            } else {
                res.writeHead(response.statusCode);
                res.end();
            }
        });
    });
}