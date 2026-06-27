/**
 * Minimal EventEmitter polyfill for browser.
 * Scratch-audio imports Node's `events` module.
 */
export default class EventEmitter {
  constructor() {
    this._listeners = {};
  }
  on(name, fn) {
    (this._listeners[name] = this._listeners[name] || []).push(fn);
    return this;
  }
  off(name, fn) {
    const arr = this._listeners[name];
    if (arr) this._listeners[name] = arr.filter(f => f !== fn);
    return this;
  }
  emit(name, ...args) {
    const arr = this._listeners[name];
    if (arr) arr.forEach(f => f(...args));
    return this;
  }
  once(name, fn) {
    const wrapper = (...args) => { fn(...args); this.off(name, wrapper); };
    return this.on(name, wrapper);
  }
  removeAllListeners(name) {
    if (name) delete this._listeners[name];
    else this._listeners = {};
    return this;
  }
  listenerCount(name) {
    const arr = this._listeners[name];
    return arr ? arr.length : 0;
  }
}
