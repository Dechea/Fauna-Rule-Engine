const {
	removeSpaces,
	deCapitalizeFirstLetter,
	countOccurrences,
	isEmpty,
	getFirstOrAll
} = require("./helper");
const { convertFqlToGraphql } = require("./fqlToGraphqlConverter");

const functionCall = '() =>';

// TEST CASES
const objectMap = new Map([[
	'authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")'
],[
	'postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)'
],[
	'userById', '(userId) => user.all.firstWhere(u => u.id == userId)'
]]);
const factMap = new Map([[
	'factAuthorNationality', '() => authorById().nationality'
],[
	'factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income'
],[
	'factPostsJob', '(postsId,postsName) => postsByIdAndName(postsId,postsName).job'
],[
	'factUserIncome', '(userId) => userById(userId).income'
],[
	'factUserJob', '(userId) => userById(userId).job'
]]);
const conditionMap = new Map([[
	'conditionAuthorNationalityEqFrance', '() => factAuthorNationality() == "France"'
],[
	'conditionPostsIncomeGt2000', '(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000'
],[
	'conditionPostsHasJob', '(postsId,postsName) => factPostsJob(postsId,postsName) == true'
],[
	'conditionUserIncomeGt2000', '(userId) => factUserIncome(userId) > 2000'
],[
	'conditionUserHasJob', '(userId) => factUserJob(userId) == true'
]]);
const ruleMap = new Map([[
	'RuleIsEligibleForCredit', '(postsId,postsName,userId) => (conditionAuthorNationalityEqFrance() && (conditionPostsIncomeGt2000(postsId,postsName) || conditionPostsHasJob(postsId,postsName) || (conditionUserIncomeGt2000(userId) && conditionUserHasJob(userId))))'
]])


const createJSON = (objectMap, factMap, conditionMap, ruleMap) => {

	let resultJSON = {};
	let updatedObjectMap = new Map();
	let updatedFactMap = new Map();
	let updatedConditionMap = new Map();

	objectMap.forEach((objectValue, objectKey) => {
		const objectName = objectKey;

		let functionVariables = '()';
		let functionCallToReplace;

		if (objectValue.includes(functionCall)) {
			functionCallToReplace = functionCall;
		} else {
			functionVariables = objectValue.split(' => ')[0];
			functionCallToReplace = `${functionVariables} => `;
		}

		const objectQuery = objectValue.replace(functionCallToReplace, '');
		const updatedObjectQuery = convertFqlToGraphql(objectQuery);

		updatedObjectMap.set(objectName, updatedObjectQuery);

		factMap.forEach((factValue, factKey) => {
			if (factValue.includes(objectName)) {
				const factName = factKey;
				let factQuery = factValue.replace(functionCallToReplace, '');

				factQuery = factQuery.replace(`${objectName}${functionVariables}`, `${objectQuery}`)
				const updatedFactQuery = convertFqlToGraphql(factQuery);

				updatedFactMap.set(factName, updatedFactQuery);
				// has to delete entry after completing transform operation
				factMap.delete(factName);

				conditionMap?.forEach((conditionValue, conditionKey) => {
					if (conditionValue.includes(factName)) {
						const conditionName = conditionKey;
						let conditionQuery = conditionValue.replace(functionCallToReplace, '');

						conditionQuery = conditionQuery.replace(`${factName}${functionVariables}`, `${factQuery}`)
						conditionQuery = conditionQuery.replace(' ', '');
						const updatedConditionQuery = convertFqlToGraphql(conditionQuery);

						updatedConditionMap.set(conditionName, updatedConditionQuery);
						// has to delete entry after completing transform operation
						conditionMap.delete(conditionName);
					}
				});
			}
		});

		// has to delete entry after completing transform operation
		// so no duplicates will be present in the transformed map
		objectMap.delete(objectName);
	});

	// After all parts of the JSON are created
	// Merge them to return the full JSON
	ruleMap?.forEach((ruleValue, ruleKey) => {

		const ruleName = deCapitalizeFirstLetter(ruleKey.replace('Rule', ''));
		let splittedString = ruleValue.split(' (');

		// remove vars from rule string
		splittedString.shift();

		const bracketsAmount = splittedString.length;
		let lastValue = splittedString[splittedString.length - 1];
		lastValue = lastValue.substring(0, lastValue.length - bracketsAmount)
		splittedString[splittedString.length - 1] = lastValue;

		let tempLastKey = '';
		let tempLastIndex = 0;

		for (let i = 0; i < splittedString.length; i++){
			const ruleEntry = splittedString[i];
			const conditionSearchParam = ruleEntry.substring(0, ruleEntry.indexOf('('))

			let entry = {};

			// At top level the json will be created
			// And filled with name and type
			// only one all/any can be placed
			if (i === 0) {
				if (ruleEntry.includes('&&')) {
					resultJSON = {
						name: ruleName,
						type: 'Rule',
						all: [
							updatedConditionMap.get(conditionSearchParam),
						]
					};
					tempLastKey = 'all';
				} else {
					resultJSON = {
						name: ruleName,
						type: 'Rule',
						any: [
							updatedConditionMap.get(conditionSearchParam),
						]
					};
					tempLastKey = 'any';
				}
			} else {
				if (ruleEntry.includes('&&')) {
					entry = createRuleEntry(ruleEntry, ' && ', updatedConditionMap);
				} else {
					entry = createRuleEntry(ruleEntry, ' || ', updatedConditionMap);
				}

				// Get current position in object
				// Add the created entries
				// Updated the index - if not first or last
				if (i === splittedString.length - 1) {
					tempLastKey.split('.').reduce((o,i)=> o[i], resultJSON).push(entry);
				} else {
					tempLastKey.split('.').reduce((o, i) => o[i], resultJSON).push(entry);
					tempLastIndex = tempLastKey.split('.').reduce((o, i) => o[i], resultJSON).length - 1;
					tempLastKey += `.${tempLastIndex}.${Object.keys(entry)}`
				}
			}
		}
	})

	// Create JSON in case it's not a rule
	if (isEmpty(resultJSON)) {
		if (updatedConditionMap.size > 0) {
			resultJSON = getFirstOrAll(updatedConditionMap);
		} else if (updatedFactMap.size > 0) {
			resultJSON = getFirstOrAll(updatedFactMap);
		}
	}

	console.log(JSON.stringify(resultJSON));

	return resultJSON;
}

const createRuleEntry = (ruleEntry, operator, updatedConditionMap) => {
	const temp = ruleEntry.split(operator);
	const tempArray = [];

	temp.forEach(tempEntry => {
		let updatedEntry = tempEntry.substring(0, tempEntry.indexOf('('))
		updatedEntry = removeSpaces(updatedEntry);
		updatedEntry = updatedConditionMap.get(updatedEntry);

		tempArray.push(updatedEntry)
	})

	if (ruleEntry.includes('&&')) {
		return  {
			all: tempArray
		};
	} else {
		return  {
			any: tempArray
		};
	}
}

console.log('INPUT:')
console.log(objectMap)
console.log(factMap)
console.log(conditionMap)
console.log(ruleMap)
console.log('-----------------')
console.log('OUTPUT:')
console.log(createJSON(objectMap, factMap, conditionMap, ruleMap));