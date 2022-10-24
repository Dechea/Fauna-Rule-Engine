const { operatorMap, numberOperators } = require("./constants");
const { convertGraphQLToFQL, getBaseQuery } = require("./graphqlToFQLConverter");
const { capitalizeFirstLetter, removeQuotes, checkBool, getByValue } = require("./helper");

let ruleMap = new Map();
const factMap = new Map();
const conditionMap = new Map();

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
        "value": 'query User {author(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {nationality}}'
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
            "value": 'query User {posts(where: {id: "ckadqdbhk00go0148zzxh4bbq", name: "Micha"}) {income}}'
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
            "value": 'query User {posts(where: {id: "ckadqdbhk00go0148zzxh4bbq", name: "Micha"}) {job}}'
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

const getQueries = (data, queries) => {
  if (!data)
    return;

  for (let index = 0; index < data.length; index++) {
    const { all, any } = data[index];
    if (all)
      getQueries(all, queries);
    else if (any)
      getQueries(any, queries);
    else {
      const { source, target } = data[index];
      if (source?.type?.toLowerCase() === 'fact')
        queries.push(source.value);
      if (target?.type?.toLowerCase() === 'fact')
        queries.push(target.value);
    }
  }
}

/* Optimizing performance and cost of rule by finding duplicated code */
const optimizeRule = (data, simpleRule) => {
  const { all, any } = data;
  const queries = [];
  getQueries(all, queries);
  getQueries(any, queries);

  const map = new Map();
  let varsString = '';
  let index = 0;

  for (const query of queries) {
    const udfString = getBaseQuery(query);

    if (!map.has(udfString)) {
      map.set(udfString, 1);
    }
    else if (map.get(udfString) === 1) {
      varsString += varsString === ''
        ? `let var${index} = ${udfString}`
        : `\nlet var${index} = ${udfString}`;
      simpleRule = simpleRule.replaceAll(udfString, `var${index}`);
      map.set(udfString, map.get(udfString) + 1);

      // Create variable name
      const udfSplit = udfString.split('.');

      let searchParam = udfSplit[udfSplit.length -1];
      searchParam = searchParam.split('==');
      searchParam = capitalizeFirstLetter(searchParam[0]);

      let variableName = `${udfSplit[0]}By${searchParam}`;

      ruleMap.set(variableName, udfString);

      index++;
    }
  }

  return {
    optimizedRules: map,
    simpleRule
  };
}

const buildRule = () => {
  const { type } = requestBody;
  switch (type.toLowerCase()) {
    case "rule":
      const simpleRule = buildCompositeRule(requestBody);
      const optimizedRule = optimizeRule(requestBody, simpleRule);
      break;
    case "condition":
      const factAndCondition = buildFactAndCondition(requestBody);
      break;
  }

  console.log(ruleMap)
  console.log(factMap)
  console.log(conditionMap)
}

const buildFactAndCondition = (data) => {
  const { source, comparator, target } = data;

  const sourceString = convertGraphQLToFQL(source.value);
  const operatorString = getCorrectOperator(comparator);
  const targetString = getTargetString(operatorString, target);

  let factName = sourceString.split('.');
  const collection = capitalizeFirstLetter(factName[0]);
  const sourceType = capitalizeFirstLetter(factName[factName.length-1]);

  factName = `fact${collection}${sourceType}`;
  const fact = `let ${factName} = ${sourceString}`;

  const formattedComparator = capitalizeFirstLetter(comparator);
  const formattedTarget = capitalizeFirstLetter(removeQuotes(targetString));

  let conditionName;

  if(checkBool(target)) {
    conditionName = target.value ? `conditionHas${sourceType}` : `conditionHasNo${sourceType}`;
  } else {
    conditionName = `condition${sourceType}${formattedComparator}${formattedTarget}`;
  }

  const condition = `let ${conditionName} = ${factName}() ${operatorString} ${targetString}`;

  factMap.set(factName, fact)
  conditionMap.set(conditionName, condition);

  return {
    factMap,
    conditionMap
  };
}

const optimizedFact = () => {

  const udf = 'let factUserNationality = user.all.firstWhere(.id == "ckadqdbhk00go0148zzxh4bbq").nationality' // Try edit me
  const map = new Map()
  map.set('userById', 'user.all.firstWhere(.id == "ckadqdbhk00go0148zzxh4bbq")')

  // 1. step to get search param
  let temp;
  let queryString;

  temp = udf.split('.');
  const factParam = temp[temp.length-1]
  console.log('fact Param: ' + factParam)
  temp.pop();

  queryString = temp.join(".");

// 2. step
  temp = queryString.split(' = ');
  console.log('query String: ' + temp[1])
  const searchParam = temp[1]
  temp.pop();

  const searchVariable = getByValue(map, searchParam)
  console.log(searchVariable)

  queryString = `${temp} = ${searchVariable}().${factParam}`;

// Log to console
  console.log(queryString)

  // return optimizedFact;
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
      ruleString += `(${buildCompositeRule(data[index])})`;
    else if (anyInner)
      ruleString += `(${buildCompositeRule(data[index])})`;
    else
      ruleString += `${buildFactAndCondition(data[index])}`;

    if (index != data.length - 1)
      ruleString += ` ${operator} `;
  }
  return ruleString;
}

const buildCompositeRule = (data) => {
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

optimizedFact();
