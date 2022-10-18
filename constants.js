const operatorMap = {
'contains' : 'includes',
'eq' : '==',
'gt': '>',
'gte' : '>=',
'lt' : '<',
'lte' : '<='
}

const numberOperators = ['==', '>', '>=', '<', '<='];

module.exports = {
  operatorMap,
  numberOperators
}
