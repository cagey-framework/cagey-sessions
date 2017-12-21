# User sessions for the Cagey game framework

[![Greenkeeper badge](https://badges.greenkeeper.io/cagey-framework/cagey-sessions.svg)](https://greenkeeper.io/)

**WORK IN PROGRESS**

A session represents a single human interacting with the system and its API provides a convenient place to combine
resources related to them. Session instances are created via the session manager's `sessionManager.create()` method.


## Installation

This installs cagey-sessions into your project:

```sh
npm install cagey-sessions --save
```


## API

### Session Manager

**factory**

Instantiating `cagey-sessions` requires you to have prepared a `cagey-logger` object. Passing it (or a child logger) on
to the session manager will allows it to log debug information for when you need it.

```js
const apis = {
    log: cageyLogger
};

const sessionManager = require('cagey-sessions').create(apis, options);
```

Creates and returns an instance of the `SessionManager` class and passes its options on to the constructor.
See the `SessionManager` constructor below for valid options.

**SessionManager(options)** (constructor)

- `options.userData.persistence` (object) Contains settings for when user data should be persisted.
- `options.userData.persistence.events` (string[]) Events for which to trigger a persist operation (`disconnect`, `shutdown`).
- `options.userData.persistence.interval` (string) Maximum interval before a persist operation is automatically triggered (eg: `30s`).

**async SessionManager.create([string key]) -> Session**

Creates and returns a session object. A session represents a single human interacting with the system and its API
provides a convenient place to combine resources related to this human interaction. If the session is identifiable by a
string, you can pass it as an argument to this method. This allows you to lookup the session using the same key later.

This emits:

- `"created" (Session session)` on the session manager itself.

**SessionManager.findByKey(string key) -> Session|undefined**

If a session was created with the given key and is still active, it will be returned. Otherwise `undefined` is returned.

**async SessionManager.persistAllUserData()**

Immediately persists the user data of all active sessions.

**SessionManager.willPersistUserDataOn(string eventName) -> boolean**

Returns `true` if the event name given is used as a trigger for persisting user data, `false` otherwise. This is based
on the options you passed when constructing the session manager.

**async SessionManager.destroy([boolean persist])**

Stops scheduled persistence, and calls `session.destroy(persist)` on all active sessions.

**Events**

- `"persistUserData" (Session session)` is emitted whenever it is time to persist user data. This should be used as the
  trigger for the integration code to write the user data to a database. You will probably want to use `session.userId`
  and `session.userData` in the logic that follows.

### Session

Session objects are created through `sessionManager.create()` and each represent a single human interacting with the
system.

**property: session.userId (string|int)**

After calling `session.setUser`, this will be set to the given user ID.

**property: session.userData (object)**

After calling `session.setUser`, this will be set to the given user data object.

**session.set(string key, any value)**

Sets any value in a key/value lookup inside the session object. A convenient place for sharing session-specific objects
(like messaging, logging or analytics APIs) so that you only have to pass the session itself between your various
project files, and not all those APIs individually.

**session.get(string key) -> any**

Returns the value that was stored for a given key (see `session.set()`), or undefined if not found.

**async session.start()**

Usually called by integration code, this emits an event on the session to let user-land integration code know that it
can start its session closure.
closure.

This emits:

- `"started" (Session session)` on the session manager this session belongs to.
- `"started" ()` on the session itself.

Example:

```js
sessionManager.on('started', (session) => {
    const client = session.get('client'); // the client messenger that wraps around our incoming WebSocket

    client.on('message:login', ({ username, password }) => {
        // login
    });
});
```

**async session.setUser(string|int userId, object userData)**

When a user is authenticated (not necessarily a requirement for your game) or otherwise identified, you can load that
user's data and store it on the session object with this API.

This emits:

- `"identified" (Session session, string|int userId, object userData)` on the session manager this session belongs to.
- `"identified" (string|int userId, object userData)` on the session itself.

Example:

```js
sessionManager.on('started', (session) => {
    const client = session.get('client'); // the client messenger that wraps around our incoming WebSocket

    client.on('message:login', async ({ username, password }) => {
        const { userId, userData } = await getUserInfo(username, password);
        session.setUser(userId, userData);
    });

    session.on('identified', (userId, userData) => {
        // this is a good time to listen for messages that only authenticated users are allowed to send

        client.on('message:logout', () => {
            session.destroy();
        });
    });
});
```

**async session.persistNow()**

Immediately persist this session's user data. This can be useful after critical moments in a game, for example when
currency is being spent.

**async session.destroy([boolean persist])**

Destroys the given session. The user data associated will be persisted if the *persist* argument is `true`.

This emits:

- `"beforeDestroy" (Session session)` on the session manager this session belongs to before persisting.
- `"beforeDestroy" ()` on the session itself before persisting.
- `"destroy" (Session session)` on the session manager this session belongs to when persisting has finished.
- `"destroy" ()` on the session itself when persisting has finished.

These events can be used to gracefully shut down client/server connections to the user for example.


## License

MIT

## Credit

Cagey is developed and maintained by [Wizcorp](https://wizcorp.jp/).
