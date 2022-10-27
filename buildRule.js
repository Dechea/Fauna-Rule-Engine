const flatten = require('flat');

const { operatorMap, numberOperators } = require("./constants");
const { convertGraphQLToFQL, getBaseQuery } = require("./graphqlToFQLConverter");
const { capitalizeFirstLetter, removeQuotes, checkBool, getByValue } = require("./helper");

let objectMap = new Map();
const factMap = new Map();
let optimizedFactMap = new Map();
const conditionMap = new Map();

const topLevel = new Map();
const midLevel = new Map();
const lowerLevel = new Map();

const functionCall = ' => ';


const fMap = new Map();
const anyMap = new Map();
const allMap = new Map();

const requestBody = {
  "type": "Rule",
  "name": "isEligibleForCredit",
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

// const optimize = (simpleRule) => {
//   return JSON.stringify(simpleRule.split('&&'))
// }

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
      variableName = variableName.replace(/ /g, '');

      objectMap.set(variableName, udfString);

      index++;
    }
  }

  return {
    optimizedRules: map,
    simpleRule
  };
}

const buildRule = () => {
  const { type, all, any } = requestBody;
  let simpleRule;

  switch (type.toLowerCase()) {
    case "rule":
      simpleRule = buildCompositeRule(requestBody);
      optimizeRule(requestBody, simpleRule);
      break;
    case "condition":
      buildFactAndCondition(requestBody);
      break;
  }

  objectMap.forEach((value, key) => {
    const object = {key, value};
    factMap.forEach((value, key) => {
      const fact = {key, value};
      optimizeFact(object, fact);
    });
  });

  console.log(objectMap);
  console.log(optimizedFactMap);
  console.log(conditionMap);

  // console.log( fMap )
  // console.log( anyMap )
  // console.log( allMap )

  // objectMap.forEach((value, key) => {
  //   console.log(createFunction(key, value))
  // });
  // optimizedFactMap.forEach((value, key) => {
  //   console.log(createFunction(key, value))
  // });
  // conditionMap.forEach((value, key) => {
  //   console.log(createFunction(key, value))
  // });
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
  const fact = `()${functionCall}${sourceString}`;

  const formattedComparator = capitalizeFirstLetter(comparator);
  const formattedTarget = capitalizeFirstLetter(removeQuotes(targetString));

  let conditionName;

  if(checkBool(target)) {
    conditionName = target.value ? `condition${collection}Has${sourceType}` : `condition${collection}HasNo${sourceType}`;
  } else {
    conditionName = `condition${collection}${sourceType}${formattedComparator}${formattedTarget}`;
  }

  const condition = `()${functionCall}${factName}() ${operatorString} ${targetString}`;

  factMap.set(factName, fact)
  conditionMap.set(conditionName, condition);

  return {
    factMap,
    conditionMap
  };
}

const optimizeFact = (object, fact) => {

  // split object and fact in key value
  const factName = fact.key;
  const factValue = fact.value;

  // create map to check object value
  const map = new Map();
  map.set(object.key, object.value)

  // 1. step
  // extract the search path
  // remove fact
  let temp;
  let queryString;

  temp = factValue.split('.');
  const factParam = temp[temp.length-1]
  temp.pop();

  queryString = temp.join(".");

  // 2. step
  // get search param from variable
  // set variable in fact
  temp = queryString.split(functionCall);
  const searchParam = temp[1]
  temp.pop();

  const searchVariable = getByValue(map, searchParam)
  if(searchVariable !== undefined) {
    // Optimized fact
    // remove space
    queryString = `${temp}${functionCall}${searchVariable}().${factParam}`;

    optimizedFactMap.set(factName, queryString);
  }

}

const createFunction = (functionName, functionBody) => {
  return `Function.create({
    name: '${functionName}',
    body: '${functionBody}'
  })`
}

const getCorrectOperator = (operator) => {
  return operatorMap[operator.toLowerCase()] || operator;
}

const getTargetString = (operatorString, target) => {
  const { type, value } = target;

  if (type.toLowerCase() === 'fact')
    return operatorString === '=='
      ? `${convertGraphQLToFQL(value)}`
      : `(${convertGraphQLToFQL(value)})`;
  else if (type.toLowerCase() === 'string')
    return operatorString === '==' ? `"${value}"` : `("${value}")`

  return value;
}


const buildNestedConditions = (data, operator) => {
  let ruleString = '';
  for (let index = 0; index < data.length; index++) {
    const { all: allInner, any: anyInner } = data[index];
    if (allInner) {
      const allInnerEntry = data[index];
      ruleString += buildCompositeRule(allInnerEntry);

      allMap.set(allInnerEntry.name, allInnerEntry)

      lowerLevel.set('all', allInnerEntry);
    } else if (anyInner) {
      const anyInnerEntry = data[index];
      ruleString += buildCompositeRule(anyInnerEntry);

      anyMap.set(anyInnerEntry.name, anyInnerEntry)

      lowerLevel.set('any', anyInnerEntry);
    } else {
      const factInnerEntry = data[index];
      ruleString += buildFactAndCondition(factInnerEntry);

      fMap.set(factInnerEntry.name, factInnerEntry)

      lowerLevel.set('fact', factInnerEntry);
    }

    if (index !== data.length - 1)
      ruleString += ` ${operator} `;
  }
  return ruleString;
}

const buildCompositeRule = (data) => {
  const { all, any } = data;

  let ruleString = '';
  if (all) {
    const allEntry = buildNestedConditions(all, '&&');
    ruleString += allEntry;

    topLevel.set('all', allEntry)
  } else if (any) {
    const anyEntry = buildNestedConditions(any, '||');
    ruleString += anyEntry;

    topLevel.set('any', anyEntry);
  }

  return ruleString;
}


function flattenJSON(obj){

  if (typeof obj !== "object" || obj === null) {
    return 0;
  }

  const flat = flatten(obj);

  // console.log(flat)

  const map = new Map(Object.entries(flat));
  iterateMap(map)

  console.log(topLevel)

  // const ruleName = `${flat.type}${capitalizeFirstLetter(flat.name)}`
  // const map = new Map();

}

function isNumeric(value) {
  return /^\d+$/.test(value);
}

const iterateMap = (data) => {

  let tempMidMap = new Map();
  let tempLowerMap = new Map();

  let oldName = Array.from(data.keys())[2].split('.');
  oldName.pop();
  oldName = oldName.join('.');

  for (const [key, value] of data.entries()) {
    const keys = key.split('.');
    keys.pop();

    const updatedAmount = keys.length;
    const updatedKey = keys[updatedAmount-1];
    const updatedName = keys.join('.');
    const checkName = key.slice(0, updatedName.length)
    const valueName = key.slice(updatedName.length + 1, key.length)

    if(updatedKey !== undefined) {
      if(isNumeric(updatedKey)) {
        if(checkName === updatedName) {
          topLevel.set(updatedName, tempMidMap);
        }
      } else {
        if(checkName === updatedName) {
          if(oldName !== updatedName) {
            tempLowerMap = new Map([[valueName, value]]);
            tempMidMap.set(updatedName, tempLowerMap);
          } else {
            tempLowerMap.set(valueName, value);
            tempMidMap = new Map([[updatedName, tempLowerMap]]);
          }
        }
      }
    }
    // necessary for usage of old/new map
    oldName = updatedName !== '' || updatedName !== undefined ? updatedName : oldName;
  }

}

flattenJSON(requestBody)

// buildRule();

