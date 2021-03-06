// in react-native process.title === undefined
let isServer = process.title && process.title !== 'browser'

let dbFields = {
  _ops: true,
  _sv: true,
  _v: true
}

function arrayRemove (array, el) {
  let index = array.indexOf(el)
  if (index > -1) {
    array.splice(index, 1)
  }
  return index
}

function deepClone (object) {
  if (object == null || typeof object !== 'object') return object

  return JSON.parse(JSON.stringify(object))
}

function fastEqual (object1, object2) {
  return JSON.stringify(object1) === JSON.stringify(object2)
}

function isLocalCollection (collectionName) {
  let firstLetter = collectionName[0]
  return firstLetter === '_' || firstLetter === '$'
}

function parsePath (path) {
  if (Array.isArray(path) && path.length === 1) {
    path = path[0]
  }
  if (!Array.isArray(path)) {
    path = path.split('.')
  }

  return path
}

function parseArguments (...args) {
  if (args.length > 1) return args

  return parsePath(Array.from(args[0]))
}

export default {
  arrayRemove,
  deepClone,
  dbFields,
  fastEqual,
  isServer,
  isLocalCollection,
  parsePath,
  parseArguments
}
