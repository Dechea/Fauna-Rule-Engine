const operatorMap = {
'contains' : 'includes',
'eq' : '==',
'gt': '>',
'gte' : '>=',
'lt' : '<',
'lte' : '<='
}

const logicalOperatorMap = {
  '&&' : ',',
  '||' : ', or : {}',
}

const numberOperators = ['==', '>', '>=', '<', '<='];

module.exports = {
  operatorMap,
  numberOperators,
  logicalOperatorMap
}
