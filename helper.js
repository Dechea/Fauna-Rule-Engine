const capitalizeFirstLetter = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.charAt(0).toUpperCase() + inputString.slice(1);
	}
	else {
		return  inputString;
	}
}

const deCapitalizeFirstLetter = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.charAt(0).toLowerCase() + inputString.slice(1);
	}
	else {
		return  inputString;
	}
}

const removeQuotes = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.replace(/^"(.+)"$/,'$1');
	}
	else {
		return  inputString;
	}
}

const removeSpaces = (inputString) => {
	return inputString.replace(/ /g, '');
}

const checkBool = (bool) => {
	return typeof bool === 'boolean' ||
		(typeof bool === 'object' &&
			bool !== null            &&
			typeof bool.value === 'boolean');
}

const getMapKeyByValue = (map, searchValue) => {
	for (let [key, value] of map.entries()) {
		if (value === searchValue)
			return key;
	}
}

const getObjKeyByValue = (obj, value) => {
	return Object.keys(obj).find(key => obj[key] === value);
}

const isNumeric = (value) => {
	return /^\d+$/.test(value);
}

const isEmpty = (obj) => {
	return Object.getOwnPropertyNames(obj).length === 0;
}

const getFirstOrAll = (map) => {
	return map.size === 1 ? map.values().next().value : Array.from(map.values());
}

const countOccurrences = (str, find) => {
	return (str.split(find)).length - 1;
}

module.exports = {
	capitalizeFirstLetter,
	deCapitalizeFirstLetter,
	removeQuotes,
	removeSpaces,
	checkBool,
	getMapKeyByValue,
	getObjKeyByValue,
	isNumeric,
	isEmpty,
	getFirstOrAll,
	countOccurrences
}