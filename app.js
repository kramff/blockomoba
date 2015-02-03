var http = require("http");
var fs = require("fs");

var socketio = require("socket.io");
var perlin = require("perlin-noise");

var mapData = require("./mapData.js");

//Cache
var files = {};

//Server
var server = http.createServer(function (req, res) {
	if (files[req.url])
	{
		//Use cached file if able
		res.write(files[req.url])
		res.end();
	}
	else if (files[req.url] == false)
	{
		//Cache already knows the file is nonexistent
		res.end("404");
	}
	else
	{
		fs.readFile("public" + req.url, function (err, data) {
			if (err)
			{
				//File is nonexistent
				files[req.url] = false;
				res.end("404");
			}
			else
			{
				//File exists, send response and save file to cache
				files[req.url] = data;
				res.write(data);
				res.end();
			}
		});
	}
});
server.listen(8080);

//Update file cache when files are updated change
fs.watch("public", function (event, filename) {
	if (files['/' + filename])
	{
		fs.readFile("public/" + filename, function (err, data) {
			if (err)
			{
				//Error
			}
			else
			{
				//Update File
				//console.log("Updated file " + filename);
				files['/' + filename] = data;
			}
		});
	}
});

//Game data
var area = [];

var pNoiseA = perlin.generatePerlinNoise(100, 100);
var pNoiseB = perlin.generatePerlinNoise(100, 100);

//Game constants
var AREA_X_SIZE = 100;
var AREA_Y_SIZE = 10;
var AREA_Z_SIZE = 100;
var EMPTY = 0;
var SOLID = 1;
var BLOCK = 2;

function Tile (x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;
}
Tile.prototype.GetAreaData = function () {
	return area[this.x][this.y][this.z];
}
Tile.prototype.SetAreaData = function (data) {
	area[this.x][this.y][this.z] = data;
}



//Tiles to keep track of after creating map
var jungleCamps = [];

console.log("Loading map...");
for (var i = 0; i < AREA_X_SIZE; i++)
{
	//X (i) : -East +West
	area[i] = [];
	for (var j = 0; j < AREA_Y_SIZE; j++)
	{
		//Y (j) : -Down +Up
		area[i][j] = [];
		for (var k = 0; k < AREA_Z_SIZE; k++)
		{
			//Z (k) : -North +South

			//Default: Empty
			var tileType = EMPTY;
			
			//Elevation
			var elev = mapData.elevation(i, k) - 1;
			var feat = mapData.features(i, k);
			if (elev == j)
			{
				tileType = SOLID;
			}
			if (j > elev)
			{
				if (feat == 11)
				{
					//11: Wall 1
					if (j <= elev + 1)
					{
						tileType = SOLID;
					}
				}
				else if (feat == 12)
				{
					//12: Wall 2
					if (j <= elev + 2)
					{
						tileType = SOLID;
					}
				}
				else if (feat == 13)
				{
					//13: Wall 3
					if (j <= elev + 3)
					{
						tileType = SOLID;
					}
				}
				else if (feat == 14)
				{
					//14: Wall 4
					if (j <= elev + 4)
					{
						tileType = SOLID;
					}
				}
				else if (feat == 15)
				{
					//15: Wall 5
					if (j <= elev + 5)
					{
						tileType = SOLID;
					}
				}
				else if (feat == 16)
				{
					//16: Block
					if (j == elev + 1)
					{
						tileType = BLOCK;
					}
				}
				else if (feat == 17)
				{
					//17: Hover Tile
					if (j == elev + 3)
					{
						tileType = SOLID;
					}
				}
				else if (feat == 18)
				{
					//18: Pit
					tileType = EMPTY;
				}
				else if (feat == 19)
				{
					//19: Jungle (Respawning blocks)
					if (j == elev + 1)
					{
						tileType = BLOCK;
						jungleCamps.push(new Tile(i, j, k));
					}
				}
				else if (feat == 20)
				{
					//20: Door
				}
			}

			if (feat == 18)
			{
				//18: Pit
				tileType = EMPTY;
			}

			//if (Math.round(Math.sin((i) / 2.5) * 2 + Math.sin((k) / 2.5) * 2 + 5) == j)
			//{
			//	tileType = SOLID;
			//}
			//if (Math.round(pNoiseA[i * 100 + k] * 4.5) == j)
			//{
			//	tileType = SOLID;
			//}
			//if ((Math.round(pNoiseA[i * 100 + k] * 4.5) == j - 1) && (Math.random() < 0.01))
			//{
			//	tileType = BLOCK;
			//}
			//if (pNoiseB[i * 100 + k] > 0.8 && j < pNoiseB[i * 100 + k] * 9)
			//{
			//	tileType = SOLID;
			//}
			//if (j == 0)
			//{
			//	//Floors
			//	tileType = SOLID;
			//}
			//if (Math.round(Math.abs((i - k) / 10)) == j)
			//{
			//	tileType = SOLID;
			//}

			//Set tile to chosen tiletype
			area[i][j][k] = tileType;
		}
	}
}
console.log("Map loaded.");
var playerArray = [];

function UpdatePlayer (player) {
	for (var i = 0; i < playerArray.length; i++)
	{
		if (playerArray[i].id == player.id)
		{
			playerArray[i] = player;
			return;
		}
	}
	playerArray.push(player);
}
function RemovePlayer (player) {
	for (var i = 0; i < playerArray.length; i++)
	{
		if (playerArray[i].id == player.id)
		{
			playerArray.splice(i, 1);
			return;
		}
	}
}

var io = socketio(server);

io.on("connection", function (socket) {
	console.log("connect");
	//Send area data
	socket.emit("area", area);
	//Disconnection
	socket.on("disconnect", function () {
		console.log("disconnect");
		socket.broadcast.emit("disconnection", {"id": socket.id});
		RemovePlayer({"id": socket.id});
	});
	//Position update
	socket.on("position", function (msg) {
		msg.id = socket.id;
		socket.broadcast.emit("position", msg);
		UpdatePlayer(msg);
	});
	//Shoot block
	socket.on("shoot", function (msg) {
		if (IsNumInt(msg.x) && IsNumInt(msg.y) && IsNumInt(msg.z) && !OutsideBounds(msg.x, msg.y, msg.z))
		{
			//Valid input, probably!
			if (area[msg.x][msg.y][msg.z] == EMPTY)
			{
				area[msg.x][msg.y][msg.z] = BLOCK;
				io.emit("block", msg);
			}
		}
	});
	//Gather block
	socket.on("gather", function (msg) {
		if (IsNumInt(msg.x) && IsNumInt(msg.y) && IsNumInt(msg.z) && !OutsideBounds(msg.x, msg.y, msg.z))
		{
			//Valid input, probably!
			if (area[msg.x][msg.y][msg.z] == BLOCK)
			{
				area[msg.x][msg.y][msg.z] = EMPTY;
				io.emit("empty", msg);
			}
		}
	});
	socket.on("shotEffect", function (msg) {
		socket.broadcast.emit("shotEffect", msg);
	});
	socket.on("deathEffect", function (msg) {
		socket.broadcast.emit("deathEffect", msg);
	});
});



var timer = 0;
function Update () {
	//for (var i = 0; i < playerArray.length; i++)
	//{
	//	var curPlayer = playerArray[i];
	//}
	
	//Timer loop
	timer ++;
	if (timer >= 60)
	{
		timer = 0;

		//Create blocks at "jungle" spots
		for (var i = 0; i < jungleCamps.length; i++)
		{
			var data = jungleCamps[i].GetAreaData();
			if (data == EMPTY)
			{
				jungleCamps[i].SetAreaData(BLOCK);
				io.emit("block", jungleCamps[i]);
			}
		}
		
	}

	
}

setInterval(Update, 30);


//same as functions in script - use some shared code???
function OutsideBounds (x, y, z) {
	if (x < 0 || y < 0 || z < 0 || x > AREA_X_SIZE - 1 || y > AREA_Y_SIZE - 1 || z > AREA_Z_SIZE - 1)
	{
		return true;
	}
	return false;
}

function IsNumInt (n) {
	if (n % 1 == 0)
	{
		return true;
	}
	return false;
}

console.log("Server ready.");