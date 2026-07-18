export function defined(value) {
  return value !== undefined && value !== null;
}

export function defaultValue(a, b) {
  if (a !== undefined && a !== null) {
    return a;
  }
  return b;
}

export function destroyObject(object) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      delete object[key];
    }
  }
}
