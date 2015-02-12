// 3D Score Conflict MMO
// Main Script
// Copyright Mark Foster 2014
// All Rights Reserved

//Socket reference
var socket = io();

//List of other players
var playerArray = [];

//Update player or add to array
function UpdatePlayer (player) {
	for (var i = 0; i < playerArray.length; i++)
	{
		if (playerArray[i].id == player.id)
		{
			if (player.message != playerArray[i].message)
			{
				//Message has changed
				//console.log("Message changed")
				var utterance = new SpeechSynthesisUtterance(player.message);
				//var voices = window.speechSynthesis.getVoices();
				//utterance.voice = voices[7];
				window.speechSynthesis.speak(utterance);
			}
			playerArray[i] = player;
			return;
		}
	}
	playerArray.push(player);
}

//Remove player from list
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

//Get document canvases
var layer1 = document.getElementById("layer1");

var ctx = layer1.getContext('2d');


//Scene setup
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
renderer.setSize(600, 600);
document.body.appendChild(renderer.domElement);

renderer.domElement.style.position = "absolute";
renderer.domElement.style.top = "0px";


var ambLight = new THREE.AmbientLight( 0x202020 ); // soft white light
scene.add( ambLight );

var dLight1 = new THREE.DirectionalLight(0xffffff, 0.25);
dLight1.position.set(0.5, 1, 0.5);
scene.add(dLight1);
var dLight2 = new THREE.DirectionalLight(0xffffff, 0.25);
dLight2.position.set(-0.5, 1, -0.5);
scene.add(dLight2);


//local player cube
var boxGeo = new THREE.BoxGeometry(1, 1, 1);
var boxMat = new THREE.MeshPhongMaterial({color: 0xff0000});
var cube = new THREE.Mesh(boxGeo, boxMat);

scene.add(cube);

cube.position.y = 1;

//local player's velocity
var xVel = 0;
var yVel = 0;
var zVel = 0;

//jump available (collided downwards last frame)
var canJump = false;

//current rounded local player position numbers 
var curX = 0;
var curY = 0;
var curZ = 0;
//previous rounded local player position numbers
var preX = 0;
var preY = 0;
var preZ = 0;

//Indicator cube (wireframe)
var indMat = new THREE.MeshPhongMaterial({color: 0x00ff00});
indMat.wireframe = true;
var indCube = new THREE.Mesh(boxGeo, indMat);
scene.add(indCube);
indCube.position.set (-1, 10, -1);

//Other player cube locations
var playerCubes = [];


//Game data
var serverArea = undefined;
var localArea = [];

//Game constants
var AREA_X_SIZE = 100;
var AREA_Y_SIZE = 10;
var AREA_Z_SIZE = 100;
var EMPTY = 0;
var SOLID = 1;
var BLOCK = 2;
//Directions
var DIR_NA = 0; //No direction
var UP = 1;
var DOWN = 2;
var LEFT = 3;
var RIGHT = 4;

for (var i = 0; i < AREA_X_SIZE; i++)
{
	//X : -East +West
	localArea[i] = [];
	for (var j = 0; j < AREA_Y_SIZE; j++)
	{
		//Y : Up - Down
		localArea[i][j] = [];
		for (var k = 0; k < AREA_Z_SIZE; k++)
		{
			localArea[i][j][k] = undefined;
		}
	}
}




var boxMat2 = new THREE.MeshPhongMaterial({color: 0x0000ff});
var solidMat = new THREE.MeshPhongMaterial({color: 0x404040});
var blockMat = new THREE.MeshPhongMaterial({color: 0xff8000});
blockMat.transparent = true;
blockMat.opacity = 0.75

var solidMatArray = [];

for (var i = 0; i < AREA_Y_SIZE; i++)
{
	var color = 0x404040 + (i % 2) * 0x303030 + i * 0x030303;
	solidMatArray.push(new THREE.MeshPhongMaterial({color: color}));
}

//Particle information and data
var spriteImage = new THREE.ImageUtils.loadTexture("particle.png");
var spriteMat = new THREE.SpriteMaterial({
	map: spriteImage,
	useScreenCoordinates: false,
	//alignment: THREE.SpriteAlignment.center,
	color: 0xffaa00,
	transparent: true,
	blending: THREE.AdditiveBlending,
	opacity: 0.07,
});
var shotMat = new THREE.MeshPhongMaterial({color: 0xff8000});
var bloodMat = new THREE.MeshPhongMaterial({color: 0xEE1030});
var particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

var particles = [];

var P_SHOT = 1;
var P_BLOOD = 2;

camera.position.z = 5;
camera.position.y = 5;
camera.rotation.x = -Math.PI / 2;

var groundGeo = new THREE.BoxGeometry(50, 1, 50);
var groundMat = new THREE.MeshPhongMaterial({color: 0x11ee00});
var ground = new THREE.Mesh(groundGeo, groundMat);
//scene.add(ground);

var wKey = false;
var aKey = false;
var sKey = false;
var dKey = false;
var spaceKey = false;
var mouseX = 300;
var mouseY = 300;
var mfollowX = 300;
var mfollowY = 300;
var mDir = DIR_NA;
var pDir = DIR_NA; //Previous direction
var dirChanged = false;
var bTargetReady = false;
var bTarget = undefined;
var gTargetReady = false;
var gTarget = undefined;

var ready = false;
var areaReady = false;

function Init () {
	ready = true;
	Render();
}

function Render () {
	if (!ready)
	{
		return
	}
	Update();
	requestAnimationFrame(Render);
	renderer.render(scene, camera);
	Clear2D();
	Render2D();
}

function Clear2D () {
	ctx.clearRect(0, 0, 600, 600);
}

function Render2D () {
	ctx.fillStyle = "#ffffff";
	var cube2Dpos = GetScrPos(cube.position);
	if (writingMessage)
	{
		ctx.fillText(messageInput + "_", cube2Dpos.x, cube2Dpos.y - 50);
	}
	else
	{
		ctx.fillText(lastMsgSent, cube2Dpos.x, cube2Dpos.y - 50);
	}

	for (var i = 0; i < playerArray.length; i++)
	{
		var player = playerArray[i];
		if (player.message)
		{
			var player2Dpos = GetScrPos(playerCubes[i].position)
			ctx.fillText(player.message, player2Dpos.x, player2Dpos.y - 50);
		}
	}
}

var prevRotation = 0;

function Update () {

	if (!ready || !areaReady)
	{
		return;
	}

	var prevX = cube.position.x;
	var prevY = cube.position.Y;
	var prevZ = cube.position.z;

	//Clean up position - If really close to a round number, round it
	if (Math.abs(cube.position.x - Math.round(cube.position.x)) < 0.001)
	{
		cube.position.x = Math.round(cube.position.x);
	}
	if (Math.abs(cube.position.y - Math.round(cube.position.y)) < 0.001)
	{
		cube.position.y = Math.round(cube.position.y);
	}
	if (Math.abs(cube.position.z - Math.round(cube.position.z)) < 0.001)
	{
		cube.position.z = Math.round(cube.position.z);
	}
	//Clean up velocity - If really close to 0, set to 0
	if (Math.abs(xVel) < 0.001)
	{
		xVel = 0;
	}
	if (Math.abs(yVel) < 0.001)
	{
		yVel = 0;
	}
	if (Math.abs(zVel) < 0.001)
	{
		zVel = 0;
	}

	var changeX = 0;
	var changeY = 0;
	var changeZ = 0;
	if (wKey)
	{
		changeZ += -0.04;
		zVel += -0.015;
	}
	if (aKey)
	{
		changeX += -0.04;
		xVel += -0.015;
	}
	if (sKey)
	{
		changeZ += 0.04;
		zVel += 0.015;
	}
	if (dKey)
	{
		changeX += 0.04;
		xVel += 0.015;
	}
	if (wKey == sKey)
	{
		changeZ += (cube.position.z * 9 + Math.round(cube.position.z)) * 0.1 - cube.position.z;
		zVel -= (cube.position.z - Math.round(cube.position.z)) * 0.1;
	}
	if (aKey == dKey)
	{
		changeX += (cube.position.x * 9 + Math.round(cube.position.x)) * 0.1 - cube.position.x;
		xVel -= (cube.position.x - Math.round(cube.position.x)) * 0.1;
	}
	var didJump = false;
	if (spaceKey && canJump)
	{
		yVel = 0.4;
		canJump = false;
		didJump = true;
	}
	




	//Determine potential new position values
	var newX = cube.position.x + xVel + changeX;
	var newY = cube.position.y + yVel + changeY;
	var newZ = cube.position.z + zVel + changeZ;

	//Collision detection
	//Do Y collision first then re-evaluate newY
	if (IsSolidR(newX, newY - 0.49, newZ, true))
	{
		cube.position.y = Math.round(newY + 0.49);
		yVel = Math.max(yVel, 0);
		changeY = Math.max(changeY, 0);
		//console.log("Down collision");
		canJump = !didJump;
	}
	else
	{
		canJump = false;

		//Only try the up collision if there is no down collision
		if (IsSolidR(newX, newY + 0.49, newZ, true))
		{
			cube.position.y = Math.round(newY - 0.49);
			yVel = Math.min(yVel, 0);
			changeY = Math.min(changeY, 0);
			//console.log("Up collision");
		}
	}
	
	newY = cube.position.y + yVel + changeY;

	//X collision
	if (IsSolidR(newX - 0.49, newY, newZ, true))
	{
		cube.position.x = Math.round(newX + 0.49);
		xVel = Math.max(xVel, 0);
		changeX = Math.max(changeX, 0);
		//console.log("West collision");
	}
	if (IsSolidR(newX + 0.49, newY, newZ, true))
	{
		cube.position.x = Math.round(newX - 0.49);
		xVel = Math.min(xVel, 0);
		changeX = Math.min(changeX, 0);
		//console.log("East collision");
	}
	//re-evaluate newX
	newX = cube.position.x + xVel + changeX;

	//Z collision
	if (IsSolidR(newX, newY, newZ - 0.49, true))
	{
		cube.position.z = Math.round(newZ + 0.49);
		zVel = Math.max(zVel, 0);
		changeZ = Math.max(changeZ, 0);
		//console.log("North collision");
	}
	if (IsSolidR(newX, newY, newZ + 0.49, true))
	{
		cube.position.z = Math.round(newZ - 0.49);
		zVel = Math.min(zVel, 0);
		changeZ = Math.min(changeZ, 0);
		//console.log("South collision");
	}
	//re-evaluate newZ
	newZ = cube.position.z + zVel + changeZ;

	//XZ Diagonal Collisions - //Use the farthest change in position to determine which rule to use 
	//NW collision
	if (IsSolidR(newX - 0.49, newY, newZ - 0.49))
	{
		//North collision rule
		if (Math.abs(cube.position.x - newX) >= Math.abs(cube.position.z - newZ))
		{
			cube.position.z = Math.round(newZ + 0.49);
			zVel = Math.max(zVel, 0);
			changeZ = Math.max(changeZ, 0);
		}

		//West collision rule
		if (Math.abs(cube.position.z - newZ) >= Math.abs(cube.position.x - newX))
		{
			cube.position.x = Math.round(newX + 0.49);
			xVel = Math.max(xVel, 0);
			changeX = Math.max(changeX, 0);
		}
		//console.log("North-West collision");
	}
	//NE collision
	if (IsSolidR(newX + 0.49, newY, newZ - 0.49))
	{
		//North collision rule
		if (Math.abs(cube.position.x - newX) >= Math.abs(cube.position.z - newZ))
		{
			cube.position.z = Math.round(newZ + 0.49);
			zVel = Math.max(zVel, 0);
			changeZ = Math.max(changeZ, 0);
		}

		//East collision rule
		if (Math.abs(cube.position.z - newZ) >= Math.abs(cube.position.x - newX))
		{
			cube.position.x = Math.round(newX - 0.49);
			xVel = Math.min(xVel, 0);
			changeX = Math.min(changeX, 0);
		}
		//console.log("North-East collision");
	}
	//SW collision
	if (IsSolidR(newX - 0.49, newY, newZ + 0.49))
	{
		//South collision rule
		if (Math.abs(cube.position.x - newX) >= Math.abs(cube.position.z - newZ))
		{
			cube.position.z = Math.round(newZ - 0.49);
			zVel = Math.min(zVel, 0);
			changeZ = Math.min(changeZ, 0);
		}

		//West collision rule
		if (Math.abs(cube.position.z - newZ) >= Math.abs(cube.position.x - newX))
		{
			cube.position.x = Math.round(newX + 0.49);
			xVel = Math.max(xVel, 0);
			changeX = Math.max(changeX, 0);
		}
		//console.log("South-East collision");
	}
	//SE collision
	if (IsSolidR(newX + 0.49, newY, newZ + 0.49))
	{
		//South collision rule
		if (Math.abs(cube.position.x - newX) >= Math.abs(cube.position.z - newZ))
		{
			cube.position.z = Math.round(newZ - 0.49);
			zVel = Math.min(zVel, 0);
			changeZ = Math.min(changeZ, 0);
		}

		//East collision rule
		if (Math.abs(cube.position.z - newZ) >= Math.abs(cube.position.x - newX))
		{
			cube.position.x = Math.round(newX - 0.49);
			xVel = Math.min(xVel, 0);
			changeX = Math.min(changeX, 0);
		}
		//console.log("South-East collision");
	}



	//Change position
	cube.position.x += xVel + changeX;
	cube.position.y += yVel + changeY;
	cube.position.z += zVel + changeZ;

	xVel *= 0.75;
	zVel *= 0.75;

	yVel -= 0.05;
	yVel *= 0.95;

	//Save from infinite fall

	if (cube.position.y < -10)
	{
		cube.position.set(2, 11, 2);
		yVel = 0;
	}

	if (cube.position.x != prevX || cube.position.y != prevY || cube.position.z != prevZ)
	{
		socket.emit("position", {"x": cube.position.x, "y": cube.position.y, "z": cube.position.z, "message":lastMsgSent});
	}
	for (var i = 0; i < playerArray.length; i++) {
		if (playerCubes.length > i)
		{
			var pCube = playerCubes[i];
			var pData = playerArray[i];
			pCube.position.x = pData.x;
			pCube.position.y = pData.y;
			pCube.position.z = pData.z;

			//Other players - dance
			if (pData.message == "/dance")
			{
				pCube.rotateY(0.2);
			}
			else
			{
				pCube.rotation.set(0, 0, 0);
			}
		}
		else
		{
			var newCube = new THREE.Mesh(boxGeo, boxMat2);
			scene.add(newCube);
			newCube.position.x = playerArray[i].x;
			newCube.position.y = playerArray[i].y;
			newCube.position.z = playerArray[i].z;
			playerCubes.push(newCube);
		}
	}
	if (playerCubes.length > playerArray.length)
	{
		scene.remove(playerCubes.pop());
	}


	//Local player - dance
	if (lastMsgSent == "/dance")
	{
		cube.rotateY(0.2);
	}
	else
	{
		cube.rotation.set(0, 0, 0);
	}


	camera.position.x = (camera.position.x * 9 + cube.position.x) * 0.1;
	camera.position.y = (camera.position.y * 9 + cube.position.y + 10) * 0.1;
	camera.position.z = (camera.position.z * 9 + cube.position.z) * 0.1;


	mfollowX = (mfollowX * 9 + mouseX) * 0.1;
	mfollowY = (mfollowY * 9 + mouseY) * 0.1;
	camera.rotation.x = (-Math.PI / 2) - ((mfollowY - 300) / 700);
	camera.rotation.y = -((mfollowX - 300) / 700);


	curX = Math.round(cube.position.x);
	curY = Math.round(cube.position.y);
	curZ = Math.round(cube.position.z);

	var positionChanged = false;
	if ((curX != preX) || (curY != preY) || (curZ != preZ))
	{
		positionChanged = true;
		MapFuncToLocalArea(HideFarBlock);
		//console.log("Hiding far blocks")
	}

	if (positionChanged || dirChanged)
	{
		dirChanged = false;
		indCube.visible = true;
		gTargetReady = false;
		var farSpace = FindFarthestEmptySpaceByDir(Math.round(cube.position.x), Math.round(cube.position.y), Math.round(cube.position.z), mDir);
		if (farSpace)
		{
			indCube.position.set(farSpace.x, farSpace.y, farSpace.z);
			bTargetReady = true;
			bTarget = farSpace;
			//console.log("Moving indicator cube");

			//Next space after (for gathering cubes)
			var nextSpace = GetNextSpaceByDir(farSpace.x, farSpace.y, farSpace.z, mDir);
			if (nextSpace)
			{
				if (serverArea[nextSpace.x][nextSpace.y][nextSpace.z] == BLOCK)
				{
					gTarget = nextSpace;
					gTargetReady = true;
				}
			}
		}
		else
		{
			indCube.visible = false;
			bTargetReady = false;
			//console.log("Hiding indicator cube");
			var nextSpace = GetNextSpaceByDir(Math.round(cube.position.x), Math.round(cube.position.y), Math.round(cube.position.z), mDir);
			if (nextSpace)
			{
				if (serverArea[nextSpace.x][nextSpace.y][nextSpace.z] == BLOCK)
				{
					gTarget = nextSpace;
					gTargetReady = true;
				}
			}
		}

	}

	preX = curX;
	preY = curY;
	preZ = curZ;

	//Particle stuff
	UpdateParticles();
}

function MapFuncToLocalArea (lambda) {
	for (var i = 0; i < AREA_X_SIZE; i++)
	{
		for (var j = 0; j < AREA_Y_SIZE; j++)
		{
			for (var k = 0; k < AREA_Z_SIZE; k++)
			{
				lambda(localArea[i][j][k]);
			}
		}
	}
}

//Map this to the area
function HideFarBlock (block) {
	if (!block)
	{
		return;
	}
	if ((block.position.x - curX) * (block.position.x - curX) + (block.position.z - curZ) * (block.position.z - curZ) > 200)
	//if ((Math.abs(block.position.x - Math.round(cube.position.x)) + Math.abs(block.position.z - Math.round(cube.position.z)) > 15.1))
	{
		block.visible = false;
	}
	else
	{
		block.visible = true;
	}
}

//Round the x, y, z values
function IsSolidR (x, y, z, cp) {
	return IsSolid(Math.round(x), Math.round(y), Math.round(z), cp);
}

//checkPlayers: true if other players are considered solid
function IsSolid (x, y, z, checkPlayers) {
	if (!areaReady)
	{
		//Area not loaded: empty????
		return false;
	}
	if (IsNumInt(x) && IsNumInt(y) && IsNumInt(z))
	{
		if (OutsideBounds(x, y, z))
		{
			//Outside bounds: empty
			//return false; //Wait and check if other players are in the space
		}
		else
		{
			if (serverArea[x][y][z] != EMPTY)
			{
				//Not empty tile = Solid tile (Block or ground)
				return true;
			}
		}
		//Outside bounds or empty tile
		//Check players if in that mode
		if (checkPlayers)
		{
			return AnyPlayerCloseToXYZ(x, y, z);
		}
		return false;
	}
	//Not a whole number position: Solid????
	console.log("Number given not an integer! IsSolid()");
	debugger;
	return true;
}

function GetNextSpaceByDir (x, y, z, dir) {
	if (dir == UP)
	{
		return GetNextSpace(x, y, z, 0, 0, -1);
	}
	else if (dir == DOWN)
	{
		return GetNextSpace(x, y, z, 0, 0, 1);
	}
	else if (dir == LEFT)
	{
		return GetNextSpace(x, y, z, -1, 0, 0);	
	}
	else if (dir == RIGHT)
	{
		return GetNextSpace(x, y, z, 1, 0, 0);
	}
	return false;
}

function GetNextSpace (x, y, z, xCh, yCh, zCh) {
	x += xCh; y += yCh; z += zCh;
	if (!OutsideBounds(x, y, z) && IsNumInt(x) && IsNumInt(y) && IsNumInt(z))
	{
		return {x: x, y: y, z: z};
	}
}

function FindFarthestEmptySpaceByDir (x, y, z, dir) {
	if (dir == UP)
	{
		return FindFarthestEmptySpace(x, y, z, 0, 0, -1);
	}
	else if (dir == DOWN)
	{
		return FindFarthestEmptySpace(x, y, z, 0, 0, 1);
	}
	else if (dir == LEFT)
	{
		return FindFarthestEmptySpace(x, y, z, -1, 0, 0);	
	}
	else if (dir == RIGHT)
	{
		return FindFarthestEmptySpace(x, y, z, 1, 0, 0);
	}
	return false;
}

//Returns false if no space was found
//x, y, z : start at player position
function FindFarthestEmptySpace (x, y, z, xCh, yCh, zCh) {
	//Move forward one space initially
	x += xCh; y += yCh; z += zCh;

	if (IsSolid(x, y, z, false))
	{
		//Solid right in front of initial position - false
		return false;
	}
	if (IsNumInt(x) && IsNumInt(y) && IsNumInt(z) && IsNumInt(xCh) && IsNumInt(yCh) && IsNumInt(zCh))
	{
		for (var i = 0; i < 100; i++)
		{
			//Move forward one space
			x += xCh; y += yCh; z += zCh;

			if (IsSolid(x, y, z, false))
			{
				return {x: x - xCh, y: y - yCh, z: z - zCh};
			}
			else if (OutsideBounds(x, y, z))
			{
				return false;
			}
		}
	}
	else
	{
		console.log("Number given not an integer! FindFarthestEmptySpace()")
	}
	//Over 100 iteration or non-integer input: false
	return false;
}

function AnyPlayerCloseToXYZ (x, y, z) {
	for (var i = 0; i < playerArray.length; i++)
	{
		if (PlayerCloseToXYZ(playerArray[i], x, y, z))
		{
			return true;
		}
	}
	return false;
}

function PlayerCloseToXYZ (player, x, y, z) {
	if (Math.round(player.x) == Math.round(x) && Math.round(player.y) == Math.round(y) && Math.round(player.z) == Math.round(z))
	{
		return true;
	}
	return false;
}

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

function DeathParticles (x, y, z) {
	for (var i = 0; i < 30; i++)
	{
		AddParticle(x, y, z, P_BLOOD);
	}
}

function ShotParticlesInLine (x, y, z, x2, y2, z2) {
	if (particles.length > 50)
	{
		return;
	}
	var dist = Math.abs(x - x2) + Math.abs(y - y2) + Math.abs(z - z2);
	for (var i = 0; i < dist * 1; i++)
	{
		var px = x + (x2 - x) * ((i / 1) / dist);
		var py = y + (y2 - y) * ((i / 1) / dist);
		var pz = z + (z2 - z) * ((i / 1) / dist);
		AddParticle(px, py, pz, P_SHOT);
	}
}

//Particle effects
function AddParticle (x, y, z, type) {
	var pColor = 0xffffff;
	switch (type)
	{
		case P_BLOOD:
		pColor = 0xcc2211;
		break;
		case P_SHOT:
		pColor = 0xffaa00;
		break;
	}

	var newPart = new THREE.Sprite(new THREE.SpriteMaterial({
									map: spriteImage,
									useScreenCoordinates: false,
									//alignment: THREE.SpriteAlignment.center,
									color: pColor,
									transparent: true,
									blending: THREE.AdditiveBlending,
									opacity: 0.07,
								}));
	newPart.scale.set(0.1, 0.1, 0.1);
	scene.add(newPart);
	newPart.position.set(x, y, z);
	particles.push(newPart);
	newPart.xVel = 0;
	newPart.yVel = 0;
	newPart.zVel = 0;
	newPart.life = 50;
	switch (type)
	{
		case P_BLOOD:
		newPart.xVel = (Math.random() - 0.5) * 0.15;
		newPart.zVel = (Math.random() - 0.5) * 0.15;
		break;
		case P_SHOT:
		newPart.xVel = (Math.random() - 0.5) * 0.02;
		newPart.yVel = (Math.random() - 0.5) * 0.02;
		newPart.zVel = (Math.random() - 0.5) * 0.02;
		break;
	}
}

function UpdateParticles () {
	for (var i = particles.length - 1; i >= 0; i--)
	{
		var part = particles[i];
		part.life --;
		if (part.life <= 0)
		{
			scene.remove(part);
			particles.splice(i, 1);
		}
		else
		{
			part.position.x += part.xVel;
			part.position.y += part.yVel;
			part.position.z += part.zVel;
			part.material.opacity =  part.life / 200;

			switch (part.type)
			{
				case P_BLOOD:
				newPart.xVel *= 0.999;
				newPart.zVel *= 0.999;
				break;
				case P_SHOT:
				newPart.xVel += (Math.random() - 0.5) * 0.001;
				newPart.yVel += (Math.random() - 0.5) * 0.001;
				newPart.zVel += (Math.random() - 0.5) * 0.001;
				break;
			}
		}

	}
}


socket.on("position", function (msg) {
	UpdatePlayer(msg);
});

socket.on("disconnection", function (msg) {
	RemovePlayer(msg);
});

socket.on("area", function (msg) {
	serverArea = msg;
	console.log("Received area");

	for (var i = 0; i < AREA_X_SIZE; i++)
	{
		for (var j = 0; j < AREA_Y_SIZE; j++)
		{
			for (var k = 0; k < AREA_Z_SIZE; k++)
			{
				if (areaReady)
				{
					//Remove previous cube, if any
					var prevCube = localArea[i][j][k];
					if (prevCube)
					{
						scene.remove(prevCube);
						localArea[i][j][k] = undefined;
					}
				}

				if (serverArea[i][j][k] == EMPTY)
				{
					//Empty
				}
				else if (serverArea[i][j][k] == SOLID)
				{
					//Solid
					var newCube = new THREE.Mesh(boxGeo, solidMatArray[j]);
					localArea[i][j][k] = newCube;

					scene.add(newCube);
					newCube.position.x = i;
					newCube.position.y = j;
					newCube.position.z = k;
				}
				else if (serverArea[i][j][k] == BLOCK)
				{
					//Block
					var newCube = new THREE.Mesh(boxGeo, blockMat);
					localArea[i][j][k] = newCube;

					scene.add(newCube);
					newCube.position.x = i;
					newCube.position.y = j;
					newCube.position.z = k;
				}
			}
		}
	}
	areaReady = true;
	cube.position.set(2, 11, 2);
});

socket.on("block", function (msg) {
	var newCube = new THREE.Mesh(boxGeo, blockMat);
	localArea[msg.x][msg.y][msg.z] = newCube;

	scene.add(newCube);
	newCube.position.x = msg.x;
	newCube.position.y = msg.y;
	newCube.position.z = msg.z;

	serverArea[msg.x][msg.y][msg.z] = BLOCK;

	dirChanged = true;

	if (msg.x == Math.round(cube.position.x) && msg.y == Math.round(cube.position.y) && msg.z == Math.round(cube.position.z))
	{
		//console.log("I died");
		DeathParticles(cube.position.x, cube.position.y, cube.position.z);
		socket.emit("deathEffect", {x: cube.position.x, y: cube.position.y, z: cube.position.z});
		cube.position.set(2, 11, 2);
	}
});

socket.on("empty", function (msg) {
	var oldCube = localArea[msg.x][msg.y][msg.z];

	if (oldCube)
	{

		scene.remove(oldCube);
		localArea[msg.x][msg.y][msg.z] = undefined;
	}
	serverArea[msg.x][msg.y][msg.z] = EMPTY;

	dirChanged = true;
});

socket.on("shotEffect", function (msg) {
	ShotParticlesInLine(msg.x, msg.y, msg.z, msg.x2, msg.y2, msg.z2);
});

socket.on("deathEffect", function (msg) {
	DeathParticles(msg.x, msg.y, msg.z);
});

function SetTile (x, y, z, type) {

	//localArea[x][y][z]
}


var writingMessage = false;
var messageInput = "";
var enterPressed = false;
var lastMsgSent = "";

var vItr = 0;

window.onkeypress = function (e) {
	if (writingMessage)
	{
		if (e.keyCode == 13 && !enterPressed)
		{
			if (messageInput.length == 0)
			{
				writingMessage = false;
				return;
			}
			// Save message
			lastMsgSent = messageInput;

			//TEXT TO SPEECH BABYYYY

			var utterance = new SpeechSynthesisUtterance(lastMsgSent);
			//var voices = window.speechSynthesis.getVoices();
			//utterance.voice = voices[7];
			//if (vItr > voices.length) vItr = 0;
			window.speechSynthesis.speak(utterance);


			messageInput = "";
			writingMessage = false;
			return;
		}
		var letter = String.fromCharCode(e.keyCode);
		letter = letter.replace(/[^a-zA-Z0-9 \\ \| ! @ # \$ % \^ & \* \( \) \- _ \+ = : ; " ' < > ,\. \? \/ \[ \] \{ \} ]/g, '');
		messageInput += letter;
		return;
	}
}

window.onkeydown = function (e) {
	if (writingMessage)
	{
		if (e.keyCode == 32)
		{
			//spacebar
			messageInput += " ";
			e.preventDefault();
		}
		if (e.keyCode == 8)
		{
			//backspace
			messageInput = messageInput.slice(0, messageInput.length - 1);
			e.preventDefault();
		}
		return;
	}
	else if (e.keyCode == 8)
	{
		//backspace
		e.preventDefault();
	}
	if (e.keyCode == 13)
	{
		if (!enterPressed)
		{
			writingMessage = true;
			wKey = false;
			aKey = false;
			sKey = false;
			dKey = false;
		}
		enterPressed = true;
		return;
	}

	if (e.keyCode == 87)
	{
		wKey = true;
	}
	if (e.keyCode == 65)
	{
		aKey = true
	}
	if (e.keyCode == 83)
	{
		sKey = true
	}
	if (e.keyCode == 68)
	{
		dKey = true
	}
	if (e.keyCode == 32)
	{
		spaceKey = true;
	}
}

window.onkeyup = function (e) {
	if (e.keyCode == 87)
	{
		wKey = false;
	}
	if (e.keyCode == 65)
	{
		aKey = false
	}
	if (e.keyCode == 83)
	{
		sKey = false
	}
	if (e.keyCode == 68)
	{
		dKey = false
	}
	if (e.keyCode == 32)
	{
		spaceKey = false;
	}

	if (e.keyCode == 13) {
		enterPressed = false;
		return;
	}
}

window.onmousemove = function (e) {
	mouseX = e.clientX - 8;
	mouseY = e.clientY - 8;

	mouseX = Math.min(Math.max(mouseX, 0), 600);
	mouseY = Math.min(Math.max(mouseY, 0), 600);

	var distUp = 300 - mouseY;
	var distDown = mouseY - 300;
	var distLeft = 300 - mouseX;
	var distRight = mouseX - 300;
	var buffer = 10;
	if (distUp > distDown + buffer && distUp > distLeft + buffer && distUp > distRight + buffer)
	{
		mDir = UP;
	}
	else if (distDown > distUp + buffer && distDown > distLeft + buffer && distDown > distRight + buffer)
	{
		mDir = DOWN;
	}
	else if (distLeft > distUp + buffer && distLeft > distDown + buffer && distLeft > distRight + buffer)
	{
		mDir = LEFT;
	}
	else if (distRight > distUp + buffer && distRight > distDown + buffer && distRight > distLeft + buffer)
	{
		mDir = RIGHT;
	}
	else
	{
		mDir = DIR_NA;
	}
	if (mDir != pDir)
	{
		dirChanged = true;
		pDir = mDir;
	}
}

window.onmousedown = function (e) {
	//console.log(mDir);
	dirChanged = true;

	//Determine if left or right click
	//0=left, 1=middle, 2=right
	var button = e.button;
	if (button == 0)
	{
		if (bTargetReady)
		{
			bTargetReady = false;
			socket.emit("shoot", bTarget);
			ShotParticlesInLine(cube.position.x, cube.position.y, cube.position.z, bTarget.x, bTarget.y, bTarget.z);
			socket.emit("shotEffect", {x: cube.position.x, y: cube.position.y, z: cube.position.z, x2: bTarget.x, y2: bTarget.y, z2: bTarget.z})
		}
	}
	if (button == 2)
	{
		if (gTargetReady)
		{
			gTargetReady = false;
			socket.emit("gather", gTarget);
		}
	}
	e.preventDefault();
}

//Prevent rightclick menu
window.oncontextmenu = function(event) {
	event.preventDefault();
	event.stopPropagation();
	return false;
};

window.addEventListener('copy', function (e) {
	console.log('copy event');
	e.clipboardData.setData('text/plain', messageInput);
	e.preventDefault();
});

window.addEventListener('paste', function (e) {
	console.log('paste event');
	messageInput += e.clipboardData.getData('text/plain');
	e.preventDefault();
});



//Audio
var music = new Audio("Lux.ogg");
//music.play();
music.onended = function (e) {
	this.currentTime = this.startTime || 0;
	this.play();
}


function GetScrPos (position) {
	return createVector(position.x, position.y, position.z, camera, 600, 600);
}

//http://stackoverflow.com/questions/11534000/three-js-converting-3d-position-to-2d-screen-position
function createVector(x, y, z, camera, width, height) {
	var p = new THREE.Vector3(x, y, z);
	var vector = p.project(camera);

	vector.x = (vector.x + 1) / 2 * width;
	vector.y = -(vector.y - 1) / 2 * height;

	return vector;
}