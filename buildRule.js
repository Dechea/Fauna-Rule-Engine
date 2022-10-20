const { operatorMap, numberOperators } = require("./constants");
const { convertGraphQLToFQL } = require("./graphqlToFQLConverter");

const requestBody = {
  "type": "Rule",
  "name": "isEligableForCredit",
  "all": [
    {
      "type": "Condition",
      "name": "isNationalityFrance",
      "source": {
        "type": "Fact",
        "name": "nationality",
        "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {nationality}}'
      },
      "comparator": "eq",
      "target": {
        "type": "String",
        "value": "France"
      }
    },
    {
      "any": [
        {
          "type": "Condition",
          "name": "isIncomeHigherThan2000",
          "source": {
            "type": "Fact",
            "name": "income",
            "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {income}}'
          },
          "comparator": "gt",
          "target": {
            "type": "Number",
            "value": 2000
          }
        },
        {
          "type": "Condition",
          "name": "hasJob",
          "source": {
            "type": "Fact",
            "name": "job",
            "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {job}}'
          },
          "comparator": "eq",
          "target": {
            "type": "Boolean",
            "value": true
          }
        },
        {
          "all": [
            {
              "type": "Condition",
              "name": "isIncomeHigherThan2000",
              "source": {
                "type": "Fact",
                "name": "income",
                "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {income}}'
              },
              "comparator": "gt",
              "target": {
                "type": "Number",
                "value": 2000
              }
            },
            {
              "type": "Condition",
              "name": "hasJob",
              "source": {
                "type": "Fact",
                "name": "job",
                "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {job}}'
              },
              "comparator": "eq",
              "target": {
                "type": "Boolean",
                "value": true
              }
            }
          ]
        }
      ]
    }
  ]
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
    return operatorString == '==' ? `"${value}"` : `("${value}")`

  return value;
}

const buildNestedConditions = (data, operator) => {
  let ruleString = '';
  for (let index = 0; index < data.length; index++) {
    const { all: allInner, any: anyInner } = data[index];
    if (allInner)
      ruleString += `(${buildRule(data[index])})`;
    else if (anyInner)
      ruleString += `(${buildRule(data[index])})`;
    else
      ruleString += `${buildCondition(data[index])}`;

    if (index != data.length - 1)
      ruleString += ` ${operator} `;
  }
  return ruleString;
}

const buildRule = (data) => {
  const { all, any } = data;
  let ruleString = '';
  if (all) {
    ruleString += `${buildNestedConditions(all, '&&')}`;
  }
  else if (any) {
    ruleString += `${buildNestedConditions(any, '||')}`;
  }
  return `${ruleString}`;
}

buildUDF();
