const { convertGraphQLToFQL } = require("./graphqlToFQLConverter");
const {
	capitalizeFirstLetter,
	removeQuotes,
	checkBool,
	isNumeric
} = require("./helper");
const { operatorMap } = require("./constants");

const functionCall = ' => ';
const prefix = 'RE_';

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

const createObjectMap = (data) => {

	let topLevelMap = new Map();
	let tempMidMap = new Map();
	let objectName;
	let inputObject = {};
	let factMap = new Map();
	let conditionMap = new Map();

	let oldName = Array.from(data.keys())[2].split('.');
	oldName.pop();
	oldName = oldName.join('.');

	for (const [key, value] of data.entries()) {
		const keys = key.split('.');
		keys.pop();

		const updatedAmount = keys.length;
		const updatedKey = keys[updatedAmount-1];
		const updatedName = keys.join('.');
		const checkName = key.slice(0, updatedName.length);
		const valueName = key.slice(updatedName.length + 1, key.length);

		if (updatedKey !== undefined) {
			// Create object name
			if(updatedKey === 'source') {
				if (valueName === 'value') {
					objectName = createObjectName(value);
				}
				inputObject.source = {
					...inputObject.source,
					[valueName]: value
				};
			} else if (updatedKey === 'target') {
				inputObject.target = {
					...inputObject.target,
					[valueName]: value
				};
			} else if (valueName === 'comparator') {
				inputObject = {
					...inputObject,
					[valueName]: value
				};
			}

			// Check if the whole object is set
			// To create the sub objects
			// And set it to the correct place
			if (
				inputObject.source?.type !== undefined
				&& inputObject.source?.name !== undefined
				&& inputObject.source?.value !== undefined
				&& 'comparator' in inputObject
				&& inputObject.target?.type !== undefined
				&& inputObject.target?.value !== undefined
			) {
				factMap = buildFactPart(inputObject.source);
				conditionMap = buildConditionPart(factMap, inputObject);

				if (isNumeric(updatedKey)) {
					// Add object name to map
					// So we can find and replace it later
					if (checkName === updatedName) {
						topLevelMap.set(updatedName, conditionMap);
					}
				}
			}
		}
		// necessary for usage of old/new map
		oldName = updatedName !== '' || updatedName !== undefined ? updatedName : oldName;
	}

	return topLevelMap;
}

function createObjectName(source) {

	const sourceString = convertGraphQLToFQL(source);
	const collection = sourceString.split('.')[0];

	// Create function name - Object
	const udfSplit = sourceString.split('.');
	udfSplit.pop()
	let object = udfSplit.join('.');

	let searchParamSplit = object.split('(');
	searchParamSplit = searchParamSplit.at(searchParamSplit.length - 1).split(' ');

	const searchParams = [];
	const variableNames = [];
	const fixedValues = [];

	searchParamSplit.forEach(searchParamPart => {
		if (searchParamPart.includes('.')) {
			searchParams.push(capitalizeFirstLetter(searchParamPart.substring(2)));
		} else if (searchParamPart.includes('&&')) {
			searchParams.push('And');
		} else if (searchParamPart.includes('$')) {
			let tempName = searchParamPart.replace('$', '');
			tempName = tempName.replace(')', '');
			tempName = `${collection}${capitalizeFirstLetter(tempName)}`;
			variableNames.push(tempName);
		} else if (searchParamPart.includes('"')) {
			fixedValues.push(
				searchParamPart.replaceAll('"', '').replaceAll(')', '')
			);
		}
	})

	let objectName = `${udfSplit[0]}By`;
	let index = 0;
	searchParams.forEach(param => {
		objectName += param

		// If gql contains fixed value
		// Add dynamically the value to name
		if (fixedValues.length > 0) {
			if (index === 0) {
				objectName += `-${fixedValues[index++]}`;
			} else if (param !== 'And') {
				objectName += `-${fixedValues[index++]}`;
			}
		}
	})
	objectName = objectName.replace(/ /g, '');
	return {object, variableNames, objectName};
}

const buildFactPart = (source) => {
	//
	const sourceString = convertGraphQLToFQL(source.value);
	// const collection = sourceString.split('.')[0];

	// let {object, variableNames, objectName} = createObjectName(source, collection);
	let {object, variableNames, objectName} = createObjectName(source.value);

	// Create function names - Fact
	let factName = sourceString.split('.');
	const collectionCapitalized = capitalizeFirstLetter(factName[0]);
	const sourceType = capitalizeFirstLetter(factName[factName.length-1]);
	factName = `fact${collectionCapitalized}${sourceType}`;

	// Check for variable usage in gql query
	let factValue = sourceString.split('.')
	factValue = factValue[factValue.length-1]

	let fact;

	if (variableNames.size === 0) {
		object = `()${functionCall}${object}`;
		fact = `()${functionCall}${objectName}().${factValue}`;

	} else {
		const updatedVariableName = variableNames.join(',');
		const updatedObject = object.replaceAll('$', '')

		object = `(${updatedVariableName})${functionCall}${updatedObject}`;
		fact = `(${updatedVariableName})${functionCall}${objectName}(${updatedVariableName}).${factValue}`;

	}

	const resultMap = new Map();
	resultMap.set('object', {[objectName]: object})
	resultMap.set('fact', {[factName]: fact})
	resultMap.set('variable', variableNames);

	return resultMap;
}

const buildConditionPart = (inputMap, inputObject) => {

	const comparatorString = inputObject.comparator;
	const source = inputObject.source;
	const target = inputObject.target;

	const operatorString = getCorrectOperator(comparatorString);
	const targetString = getTargetString(operatorString, target);

	const objectObject = inputMap.get('object');
	let objectName = Object.keys(objectObject)[0];
	let object = objectObject[objectName];

	const factObject = inputMap.get('fact');
	let factName = Object.keys(factObject)[0];
	let factValue = factObject[factName];
	const variableNames = inputMap.get('variable');

	const collection = objectName.split('By')[0];
	const collectionCapitalized = capitalizeFirstLetter(collection);
	const sourceType = capitalizeFirstLetter(source.name);

	// Create function names - Condition
	const formattedComparator = capitalizeFirstLetter(comparatorString);
	const formattedTarget = capitalizeFirstLetter(removeQuotes(targetString));

	let conditionName;
	if (checkBool(target)) {
		conditionName = target.value ? `condition${collectionCapitalized}Has${sourceType}` : `condition${collectionCapitalized}HasNo${sourceType}`;
	} else {
		conditionName = `condition${collectionCapitalized}${sourceType}${formattedComparator}${formattedTarget}`;
	}

	let condition;
	if (variableNames.size === 0) {
		condition = `()${functionCall}${factName}() ${operatorString} ${targetString}`;
	} else {
		const updatedVariableName = variableNames.join(',');
		condition = `(${updatedVariableName})${functionCall}${factName}(${updatedVariableName}) ${operatorString} ${targetString}`;
	}

	// const resultMap = new Map();
	// resultMap.set('object', {[objectName]: object})
	// resultMap.set('fact', {[factName]: factValue})
	inputMap.set('condition', {[conditionName]: condition});

	return inputMap;
}

const buildRulePart = (inputMap, ruleName) => {

	const updatedRuleName = `${prefix}Rule${capitalizeFirstLetter(ruleName)}`;
	const resultMap = new Map();

	resultMap.set('object', {})
	resultMap.set('fact', {})
	resultMap.set('condition', {})

	inputMap.forEach((value, key) => {
		Object.assign(resultMap.get('object'), value.get('object'));
		Object.assign(resultMap.get('fact'), value.get('fact'));
		Object.assign(resultMap.get('condition'), value.get('condition'));
	});
	
	const openBracket = '(';
	const closeBracket = ')';
	const [firstKey] = inputMap.keys();
	const [lastKey] = [...inputMap].at(-1)

	let oldKey = firstKey;
	let updatedKey = firstKey;
	let ruleString;
	let counterBrackets = 0;
	let allUsedVariables = new Set();
	let temp;

	ruleString = openBracket;
	counterBrackets++;
	inputMap.forEach((value, key) => {
		allUsedVariables.add(value.get('variable'));

		temp = Object.values(value.get('condition'));

		// check for position
		if (key === oldKey && key.length === oldKey.length) {
			ruleString += temp;

			if (updatedKey.startsWith('all')) {
				ruleString += ' && '
			} else {
				ruleString += ' || '
			}
		} else {
			// get correct position from key
			if (key.length !== oldKey.length) {
				updatedKey = key.slice(oldKey.length + 1);
			}

			// add brackets and operator
			// only if it's not the last key
			if(key !== lastKey) {
				ruleString += openBracket;
				ruleString += temp;
				counterBrackets++;

				if (updatedKey.startsWith('all')) {
					ruleString += ' && '
				} else {
					ruleString += ' || '
				}
			} else {
				ruleString += temp;
			}
		}

		oldKey = key;
	})

	// add the correct amount of brackets
	const brackets = closeBracket.repeat(counterBrackets);
	ruleString += brackets;

	const rule = `(${[...allUsedVariables].flat().join(',')})${functionCall}${ruleString}`;
	resultMap.set('rule', {[updatedRuleName]: rule});

	return resultMap;
}

const createFunction = (functionName, functionBody) => {
	return `Function.create({
    name: '${functionName}',
    body: '${functionBody}'
  })`
}

module.exports = {
	createObjectMap,
	buildFactPart,
	buildConditionPart,
	buildRulePart,
	createFunction
}