const operatorMap = {
'contains' : 'includes',
'eq' : '==',
'gt': '>',
'gte' : '>=',
'lt' : '<',
'lte' : '<='
}

const logicalOperatorMap = {
  '&&' : ','
}

const numberOperators = ['==', '>', '>=', '<', '<='];

module.exports = {
  operatorMap,
  numberOperators,
  logicalOperatorMap
}
