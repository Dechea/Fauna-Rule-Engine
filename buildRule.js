const flatten = require('flat');
const {
  buildFactPart,
  buildConditionPart,
  buildRulePart,
  createObjectMap
} = require("./buildParts");

const build = (obj) => {
  if (typeof obj !== "object" || obj === null) {
    return 0;
  }

  const flatt = flatten(obj);
  const flattMap = new Map(Object.entries(flatt));

  switch (flattMap.get('type')) {
    case 'Fact':
      return buildFact(obj);
    case 'Condition':
      return buildCondition(obj);
    case 'Rule':
      return buildRule(obj, flattMap);
  }
}

const buildFact = inputObject => buildFactPart(inputObject);

const buildCondition = (inputObject) => {
  const map = buildFactPart(inputObject.source);

  return buildConditionPart(map, inputObject);
}

const buildRule = (inputObject, flattMap) => {
  const ruleName = flattMap.get('name');
  const topLevelMap = createObjectMap(flattMap);

  return buildRulePart(topLevelMap, ruleName);
}

module.exports = {
  build
}
