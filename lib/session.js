'use strict';

const EventEmitter = require('eventemitter2').EventEmitter2;


class Session extends EventEmitter {
	constructor(sessionManager, { log }, options = {}) {
		super();

		this.log = log;

		this.sessionManager = sessionManager;
		this.key = options.key;
		this.userId = undefined;
		this.userData = undefined;
		this.data = {};
	}

	set(key, value) {
		this.data[key] = value;
	}

	get(key) {
		return this.data[key];
	}

	async start() {
		this.log.debug('[sessions] Session started');

		await this.sessionManager.emitAsync('started', this);
		await this.emitAsync('started');
	}

	async setUser(userId, userData) {
		this.log.debug('[sessions] Session authenticated');

		this.userId = userId;
		this.userData = userData;

		await this.sessionManager.emitAsync('authenticated', this, userId, userData);
		await this.emitAsync('authenticated', userId, userData);
	}

	async persistNow() {
		if (this.userId !== undefined && this.userData !== undefined) {
			await this.sessionManager.invokePersistUserData(this);

			this.sessionManager.lowerPersistPriority(this);
		}
	}

	async destroy(persist) {
		// emitting now allows userland logic to disconnect from messenging services etc

		this.log.debug('[sessions] Destroying session');

		await this.sessionManager.emitAsync('beforeDestroy', this);
		await this.emitAsync('beforeDestroy');

		if (persist && this.userId !== undefined && this.userData !== undefined) {
			await this.sessionManager.invokePersistUserData(this);
		}

		this.sessionManager.forgetSession(this);

		await this.sessionManager.emitAsync('destroy', this);
		await this.emitAsync('destroy');
	}
}

exports.create = function (sessionManager, apis, options) {
	return new Session(sessionManager, apis, options);
};
