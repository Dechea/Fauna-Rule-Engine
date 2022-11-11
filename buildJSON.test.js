const { createJSON } = require("./buildJSON");

let objectMap = new Map();
let factMap = new Map();
let conditionMap = new Map();
let ruleMap = new Map();

test("Create object and fact without variable", () => {
	objectMap.set('authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")');
	factMap.set('factAuthorNationality', '() => authorById().nationality');

	const result = createJSON(objectMap, factMap);

	expect(result).toEqual( {
		type: 'Fact',
		name: 'nationality',
		value: 'query MyQuery { author(where: { id : "ckadqdbhk00go0148zzxh4bbq"} ) { nationality }}'
	});
})

test("Create object and fact with variable", () => {
	objectMap.set('postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)');
	factMap.set('factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income');

	const result = createJSON(objectMap, factMap);

	expect(result).toEqual( {
		type: 'Fact',
		name: 'income',
		value: 'query MyQuery { posts(where: { id : $id , name : $name} ) { income }}'
	});
})

test("Create object, fact and condition without variable", () => {
	objectMap.set('authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")');
	factMap.set('factAuthorNationality', '() => authorById().nationality');
	conditionMap.set('conditionAuthorNationalityEqFrance', '() => factAuthorNationality() == "France"');

	const result = createJSON(objectMap, factMap, conditionMap);

	expect(result).toEqual( {
		type: 'Condition',
		source: {
			type: 'Fact',
			name: 'nationality',
			value: 'query MyQuery { author(where: { id : "ckadqdbhk00go0148zzxh4bbq"} ) { nationality }}'
		},
		comparator: 'eq',
		target: { type: 'String', value: 'France' }
	});
})

test("Create object, fact and condition with variable", () => {
	objectMap.set('postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)');
	factMap.set('factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income');
	conditionMap.set('conditionPostsIncomeGt2000', '(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000');


	const result = createJSON(objectMap, factMap, conditionMap);

	expect(result).toEqual( {
		type: 'Condition',
		source: {
			type: 'Fact',
			name: 'income',
			value: 'query MyQuery { posts(where: { id : $id , name : $name} ) { income }}'
		},
		comparator: 'gt',
		target: { type: 'Number', value: 2000 }
	});
})

// const objectMap = new Map([[
// 	'authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")'
// ],[
// 	'postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)'
// ],[
// 	'userById', '(userId) => user.all.firstWhere(u => u.id == userId)'
// ]]);
// const factMap = new Map([[
// 	'factAuthorNationality', '() => authorById().nationality'
// ],[
// 	'factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income'
// ],[
// 	'factPostsJob', '(postsId,postsName) => postsByIdAndName(postsId,postsName).job'
// ],[
// 	'factUserIncome', '(userId) => userById(userId).income'
// ],[
// 	'factUserJob', '(userId) => userById(userId).job'
// ]]);
// const conditionMap = new Map([[
// 	'conditionAuthorNationalityEqFrance', '() => factAuthorNationality() == "France"'
// ],[
// 	'conditionPostsIncomeGt2000', '(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000'
// ],[
// 	'conditionPostsHasJob', '(postsId,postsName) => factPostsJob(postsId,postsName) == true'
// ],[
// 	'conditionUserIncomeGt2000', '(userId) => factUserIncome(userId) > 2000'
// ],[
// 	'conditionUserHasJob', '(userId) => factUserJob(userId) == true'
// ]]);
// const ruleMap = new Map([[
// 	'RuleIsEligibleForCredit', '(postsId,postsName,userId) => (conditionAuthorNationalityEqFrance() && (conditionPostsIncomeGt2000(postsId,postsName) || conditionPostsHasJob(postsId,postsName) || (conditionUserIncomeGt2000(userId) && conditionUserHasJob(userId))))'
// ]])