"use strict";

const path = require("path"),
	lru = require("tiny-lru"),
	woodland = require("woodland"),
	etag = require("tiny-etag"),
	middleware = require(path.join(__dirname, "lib", "middleware.js")),
	TurtleIO = require(path.join(__dirname, "lib", "turtleio.js")),
	utility = require(path.join(__dirname, "lib", "utility.js")),
	version = require(path.join(__dirname, "package.json")).version;

function factory (cfg = {}, errHandler = null) {
	let obj = new TurtleIO();

	function decorate(req, res, next) {
		req.hash = obj.hash(req.parsed.href);
		req.server = obj;

		res.redirect = (target, status = 302) => {
			return obj.send(req, res, "", status, {location: target});
		};

		res.respond = (arg, status, headers) => {
			return obj.send(req, res, arg, status, headers);
		};

		res.error = (status, arg) => {
			return obj.error(req, res, status, arg);
		};

		res.send = (arg, status, headers) => {
			return obj.send(req, res, arg, status, headers);
		};

		next();
	}

	utility.merge(obj.config, cfg);

	if (!obj.config.headers.server) {
		obj.config.headers.server = "turtle.io/" + version + " (" + utility.capitalize(process.platform) + ")";
	}

	if (!obj.config.headers["x-powered-by"]) {
		obj.config.headers["x-powered-by"] = "node.js/" + process.versions.node.replace(/^v/, "");
	}

	obj.etags = etag({
		cacheSize: obj.config.cacheSize,
		seed: obj.config.seed
	});

	obj.router = woodland({
		cacheSize: obj.config.cacheSize,
		defaultHost: obj.config.default,
		defaultHeaders: {
			server: obj.config.headers.server,
			"x-powered-by": obj.config.headers["x-powered-by"]
		},
		hosts: Object.keys(obj.config.hosts),
		seed: obj.config.seed
	});

	// Making up for the ETag middleware
	obj.router.onfinish = (req , res) => {
		if (res.statusCode === 304) {
			obj.log(obj.clf(req, res, res._headers), "info");
		}
	};

	if (typeof errHandler === "function") {
		obj.router.onerror = errHandler;
	} else {
		obj.router.onerror = (req, res, e) => {
			let body, status;

			if (isNaN(e.message)) {
				status = 500;
				body = e.message;
				obj.log(body, "error");
			} else {
				status = Number(e.message);
			}

			return obj.error(req, res, status, body);
		};
	}

	[
		["all", [obj.etags.middleware, middleware.timer, decorate, middleware.payload, middleware.cors]],
		["get", [middleware.valid, middleware.file, middleware.stream]]
	].forEach(list => {
		list[1].forEach(fn => {
			obj.use("/.*", fn, list[0], "all").blacklist(fn);
		});
	});

	return obj;
}

module.exports = factory;
