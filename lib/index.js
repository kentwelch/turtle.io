"use strict";

var path = require("path");
var middleware = require(path.join(__dirname, "middleware.js"));
var TurtleIO = require(path.join(__dirname, "turtleio.js"));

function factory() {
	var app = new TurtleIO();

	// Creating default middleware map
	app.middleware.set("all", new Map());

	// Setting default middleware
	[middleware.cors, middleware.etag, middleware.connect].forEach(function (i) {
		app.use(i).blacklist(i);
	});

	return app;
}

module.exports = factory;