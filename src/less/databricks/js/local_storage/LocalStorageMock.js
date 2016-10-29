const storageMock = function storageMock() {
  let storage = {};

  return {
    setItem(key, value) {
      storage[key] = String(value);
    },
    getItem(key) {
      return storage[key];
    },
    removeItem(key) {
      delete storage[key];
    },
    clear() {
      storage = {};
    },
  };
};

const mockLocalStorage = function mockLocalStorage() {
  window.localStorage = storageMock();
};

mockLocalStorage.storageMock = storageMock;

module.exports = mockLocalStorage;
