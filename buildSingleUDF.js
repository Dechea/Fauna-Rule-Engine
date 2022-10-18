const { operatorMap, numberOperators } = require("./constants");
const { convertGraphQLToFQL } = require("./graphqlToFQLConverter");

const requestBody = {
  "type": "Condition",
  "name": "isNationalityFrance",
  "source": {
    "type": "Fact",
    "name": "nationality",
    "value": `query User {
      user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {
        nationality
      }
    }`
  },
  "comparator": "eq",
  "target": {
    "type": "Fact",
    "name": "nationality",
    "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {nationality}}'
  }
}

const buildUDF = () => {
  const { type } = requestBody;
  switch (type.toLowerCase()) {
    case "rule":
      const rule = buildRule(requestBody);
      console.log(rule);
      break;
    case "condition":
      const condition = buildCondition(requestBody);
      console.log(condition);
      break;
  }
}

const buildCondition = (data) => {
  const { source, comparator, target } = data;
  const sourceString = convertGraphQLToFQL(source.value);
  const operatorString = getCorrectOperator(comparator);
  const targetString = getTargetString(operatorString, target);

  return numberOperators.includes(operatorString)
    ? `${sourceString} ${operatorString} ${targetString}`
    : `${sourceString}.${operatorString}${targetString}`;
}

const getCorrectOperator = (operator) => {
  return operatorMap[operator.toLowerCase()] || operator;
}

const getTargetString = (operatorString, target) => {
  const { type, value } = target;

  if (type.toLowerCase() === 'fact')
    return operatorString == '==' 
    ? `${convertGraphQLToFQL(value)}` 
    : `(${convertGraphQLToFQL(value)})`;
  else if (type.toLowerCase() === 'string')
    return operatorString == '==' ? `"${value}"`: `("${value}")`

  return value;
}

const buildRule = (data) => {
  
}

buildUDF();