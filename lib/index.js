'use strict';

const createSession = require('./session').create;
const deepCopy = require('deep-copy');
const parseDuration = require('parse-duration');
const EventEmitter = require('eventemitter2').EventEmitter2;


class SessionManager extends EventEmitter {
	constructor({ log }, options = {}) {
		super();

		this.log = log;

		options = deepCopy(options);
		options.userData = options.userData || {};
		options.userData.persistence = options.userData.persistence || {};

		if (options.userData.persistence.interval) {
			// eg: "5s" -> 5000
			options.userData.persistence.interval = parseDuration(options.userData.persistence.interval);
		}

		this.options = options;

		this._sessionsByKey = {};
		this._sessionsSet = new Set(); // iterates in insertion order
		this._persistenceTimer = undefined;
		this._fnPersistUserData = undefined;

		if (options.userData.persistence.interval) {
			this._setupPersistenceAtInterval(options.userData.persistence.interval);
		}
	}

	_setupPersistenceAtInterval(interval) {
		let persisting = false;

		this._persistenceTimer = setInterval(async () => {
			if (persisting) {
				return;
			}

			persisting = true;

			try {
				await this.persistAllUserData();
			} finally {
				persisting = false;
			}
		}, interval);

		this._persistenceTimer.unref();
	}

	async create(key) {
		if (key) {
			this.log.trace('[sessions] Creating session with key "%s"', key);
		} else {
			this.log.trace('[sessions] Creating session without key');
		}

		const session = createSession(this, { log: this.log.child({ key }) }, { key });

		if (key) {
			this._sessionsByKey[key] = session;
		}

		this._sessionsSet.add(session);

		await this.emitAsync('created', session);

		return session;
	}

	findByKey(key) {
		return this._sessionsByKey[key];
	}

	async invokePersistUserData(session) {
		await this.emitAsync('persistUserData', session);
	}

	lowerPersistPriority(session) {
		// re-adding ensures it's at the end of the set

		this._sessionsSet.delete(session);
		this._sessionsSet.add(session);
	}

	willPersistUserDataOn(eventName) {
		const persistence = this.options.userData.persistence;
		if (!persistence.events) {
			return false;
		}

		return persistence.events.includes(eventName);
	}

	async persistAllUserData() {
		this.log.trace('[sessions] Persisting all user data');

		for (const session of this._sessionsSet) {
			await this.invokePersistUserData(session);
		}
	}

	forgetSession(session) {
		if (session.key) {
			delete this._sessionsByKey[session.key];
		}

		this._sessionsSet.delete(session);
	}

	async destroy(persist) {
		this.log.trace('[sessions] Destroying all sessions');

		if (this.persistenceTimer) {
			clearInterval(this.persistenceTimer);
			this.persistenceTimer = undefined;
		}

		for (const session of this._sessionsSet) {
			// note: destroy will call forgetSession, so we do not have to clean out our collection here
			await session.destroy(persist);
		}
	}
}


exports.create = function (apis, options) {
	return new SessionManager(apis, options);
};
